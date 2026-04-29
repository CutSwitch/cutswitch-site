import { unstable_noStore as noStore } from "next/cache";

import type { SegmentUserRow } from "@/lib/admin/segments";
import { getAdminSegments } from "@/lib/admin/segments";
import { getFeedbackRows } from "@/lib/admin/data";
import { sendNudgeEmail } from "@/lib/admin/nudgeEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NudgeStatus = "draft" | "reviewed" | "suppressed" | "sent_placeholder" | "sent";

export type NudgeRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  nudge_type: string;
  channel: string;
  status: NudgeStatus;
  trigger_reason: string | null;
  subject: string | null;
  message: string | null;
  segment_key: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  suppressed_at: string | null;
};

type Candidate = {
  user_id: string;
  user_email: string | null;
  nudge_type: string;
  segment_key: string;
  trigger_reason: string;
  subject: string;
  message: string;
  metadata_json: Record<string, unknown>;
};

const NO_STORE = { "Cache-Control": "no-store" };

function isMissingNudgeSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

function isMissingSuppressionSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

function sevenDaysAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function template(type: string) {
  const templates: Record<string, { subject: string; message: string }> = {
    trial_never_ran: {
      subject: "Want help creating your first CutSwitch edit?",
      message: "You started a trial but haven't created your first edit yet. Import a Final Cut project and CutSwitch will guide the next step.",
    },
    imported_not_completed: {
      subject: "Need help finishing your first CutSwitch run?",
      message: "It looks like you imported a project but did not complete a run. If anything felt confusing, reply and tell us where you got stuck.",
    },
    failed_twice: {
      subject: "Looks like CutSwitch hit a snag",
      message: "We noticed a couple failed runs. If you reply with what happened, we can help diagnose it.",
    },
    low_editing_time_remaining: {
      subject: "You're running low on editing time",
      message: "You're close to your current editing-time limit. Upgrade when you're ready to keep creating edits.",
    },
    trial_editing_time_exhausted: {
      subject: "Your trial editing time is used up",
      message: "Your trial editing time is used up. Choose a plan when you're ready to keep creating CutSwitch edits.",
    },
    paid_user_near_quota: {
      subject: "You're close to your monthly editing-time limit",
      message: "You're close to your monthly editing-time limit. A higher plan gives you more room for longer shows and client work.",
    },
    heavy_user_upsell: {
      subject: "You're one of our heaviest CutSwitch users",
      message: "You're one of our heaviest CutSwitch users. Want to tell us what would make CutSwitch even better for your workflow?",
    },
    canceled_user_reactivation: {
      subject: "Quick question about CutSwitch",
      message: "Quick question: what made you stop using CutSwitch? Your feedback directly shapes what we fix next.",
    },
    praise_testimonial_request: {
      subject: "Could we quote your CutSwitch feedback?",
      message: "Thanks for the kind words. Would you be open to us using your feedback as a testimonial?",
    },
    export_error_followup: {
      subject: "Need help with your CutSwitch export?",
      message: "It looks like export may have been frustrating. If you reply with what happened, we can help troubleshoot it.",
    },
  };
  return templates[type];
}

function candidateFromUser(user: SegmentUserRow, type: string, segmentKey: string, reason = user.reason): Candidate {
  const copy = template(type);
  return {
    user_id: user.id,
    user_email: user.email,
    nudge_type: type,
    segment_key: segmentKey,
    trigger_reason: reason,
    subject: copy.subject,
    message: copy.message,
    metadata_json: {
      plan: user.plan,
      subscription_status: user.subscription_status,
      last_active_at: user.last_active_at,
      editing_seconds_used: user.editing_seconds_used,
      editing_seconds_remaining: user.editing_seconds_remaining,
      suggested_next_action: user.suggestedNextAction,
    },
  };
}

async function buildCandidates() {
  const [segments, feedback] = await Promise.all([getAdminSegments(), getFeedbackRows({ limit: 1000 })]);
  const byKey = new Map(segments.map((segment) => [segment.key, segment.rows]));
  const candidates: Candidate[] = [];

  for (const user of byKey.get("trial_never_ran") || []) candidates.push(candidateFromUser(user, "trial_never_ran", "trial_never_ran"));
  for (const user of byKey.get("imported_not_completed") || []) candidates.push(candidateFromUser(user, "imported_not_completed", "imported_not_completed"));
  for (const user of byKey.get("failed_twice") || []) candidates.push(candidateFromUser(user, "failed_twice", "failed_twice"));
  for (const user of byKey.get("near_quota") || []) candidates.push(candidateFromUser(user, "low_editing_time_remaining", "near_quota"));
  for (const user of byKey.get("trial_exhausted") || []) candidates.push(candidateFromUser(user, "trial_editing_time_exhausted", "trial_exhausted"));
  for (const user of byKey.get("paid_user_near_limit") || []) candidates.push(candidateFromUser(user, "paid_user_near_quota", "paid_user_near_limit"));
  for (const user of byKey.get("heavy_user") || []) candidates.push(candidateFromUser(user, "heavy_user_upsell", "heavy_user"));
  for (const user of byKey.get("positive_feedback") || []) candidates.push(candidateFromUser(user, "praise_testimonial_request", "positive_feedback"));
  for (const user of byKey.get("cancellation_risk") || []) {
    if (user.subscription_status === "canceled") candidates.push(candidateFromUser(user, "canceled_user_reactivation", "cancellation_risk"));
  }

  for (const item of feedback) {
    if (!item.user_id || !item.user_email) continue;
    const area = item.product_area || item.ai_category;
    if (item.type !== "export" && area !== "export") continue;
    const copy = template("export_error_followup");
    candidates.push({
      user_id: item.user_id,
      user_email: item.user_email,
      nudge_type: "export_error_followup",
      segment_key: "export_error_followup",
      trigger_reason: item.title || item.summary || item.message.slice(0, 160),
      subject: copy.subject,
      message: copy.message,
      metadata_json: {
        feedback_id: item.id,
        feedback_status: item.status,
        product_area: area || null,
      },
    });
  }

  return candidates;
}

async function existingRecentKeys() {
  const { data, error } = await supabaseAdmin
    .from("nudge_events")
    .select("user_id,nudge_type,segment_key,created_at")
    .gte("created_at", sevenDaysAgoIso())
    .returns<Array<{ user_id: string | null; nudge_type: string; segment_key: string | null; created_at: string }>>();
  if (error) {
    if (isMissingNudgeSchema(error)) return null;
    throw error;
  }
  return new Set((data || []).map((row) => `${row.user_id}:${row.nudge_type}:${row.segment_key}`));
}

export async function ensureNudgeDrafts() {
  noStore();
  const existing = await existingRecentKeys();
  if (!existing) return { inserted: 0, schemaMissing: true };

  const candidates = await buildCandidates();
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.user_id}:${candidate.nudge_type}:${candidate.segment_key}`;
    if (!existing.has(key) && !unique.has(key)) unique.set(key, candidate);
  }

  const inserts = [...unique.values()].map(({ user_email: _userEmail, ...candidate }) => ({
    ...candidate,
    channel: "email",
    status: "draft",
  }));

  if (!inserts.length) return { inserted: 0, schemaMissing: false };

  const { error } = await supabaseAdmin.from("nudge_events").insert(inserts);
  if (error) {
    if (isMissingNudgeSchema(error)) return { inserted: 0, schemaMissing: true };
    throw error;
  }
  return { inserted: inserts.length, schemaMissing: false };
}

export async function getNudgeQueue() {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("nudge_events")
    .select("id,user_id,nudge_type,channel,status,trigger_reason,subject,message,segment_key,metadata_json,created_at,reviewed_at,sent_at,suppressed_at")
    .order("created_at", { ascending: false })
    .limit(250)
    .returns<NudgeRow[]>();
  if (error) {
    if (isMissingNudgeSchema(error)) return { rows: [] as NudgeRow[], schemaMissing: true };
    throw error;
  }

  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean) as string[])];
  const emails = new Map<string, string | null>();
  if (userIds.length) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .in("id", userIds)
      .returns<Array<{ id: string; email: string | null }>>();
    if (usersError) throw usersError;
    for (const user of users || []) emails.set(user.id, user.email);
  }

  return {
    schemaMissing: false,
    rows: (data || []).map((row) => ({
      ...row,
      user_email: row.user_id ? emails.get(row.user_id) ?? null : null,
    })),
  };
}

export async function getNudgeById(id: string) {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("nudge_events")
    .select("id,user_id,nudge_type,channel,status,trigger_reason,subject,message,segment_key,metadata_json,created_at,reviewed_at,sent_at,suppressed_at")
    .eq("id", id)
    .maybeSingle<NudgeRow>();
  if (error) throw error;
  if (!data) return null;

  let userEmail: string | null = null;
  if (data.user_id) {
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", data.user_id)
      .maybeSingle<{ email: string | null }>();
    if (userError) throw userError;
    userEmail = user?.email || null;
  }

  return { ...data, user_email: userEmail } satisfies NudgeRow;
}

export async function updateNudgeStatus(input: { id: string; status: NudgeStatus; adminUserId: string }) {
  noStore();
  const now = new Date().toISOString();
  const patch: Partial<NudgeRow> = { status: input.status };
  if (input.status === "reviewed") patch.reviewed_at = now;
  if (input.status === "suppressed") patch.suppressed_at = now;
  if (input.status === "sent_placeholder" || input.status === "sent") patch.sent_at = now;

  const { error } = await supabaseAdmin.from("nudge_events").update(patch).eq("id", input.id);
  if (error) throw error;

  const { error: auditError } = await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "nudge_status_updated",
    target_type: "nudge_event",
    target_id: input.id,
    metadata_json: { status: input.status, sending_enabled: false },
  });
  if (auditError) throw auditError;
}

async function isSuppressed(input: { userId: string | null; email: string }) {
  let query = supabaseAdmin
    .from("email_suppressions")
    .select("id")
    .ilike("email", input.email)
    .limit(1);
  const { data, error } = await query.returns<Array<{ id: string }>>();
  if (error) {
    if (isMissingSuppressionSchema(error)) return { suppressed: false, schemaMissing: true };
    throw error;
  }
  if (data?.length) return { suppressed: true, schemaMissing: false };

  if (!input.userId) return { suppressed: false, schemaMissing: false };
  const { data: userRows, error: userError } = await supabaseAdmin
    .from("email_suppressions")
    .select("id")
    .eq("user_id", input.userId)
    .limit(1)
    .returns<Array<{ id: string }>>();
  if (userError) {
    if (isMissingSuppressionSchema(userError)) return { suppressed: false, schemaMissing: true };
    throw userError;
  }
  return { suppressed: Boolean(userRows?.length), schemaMissing: false };
}

export async function sendReviewedNudge(input: { id: string; adminUserId: string }) {
  noStore();
  const nudge = await getNudgeById(input.id);
  if (!nudge) return { ok: false as const, status: 404, error: "Nudge not found." };
  if (nudge.status !== "reviewed") return { ok: false as const, status: 400, error: "Only reviewed nudges can be sent." };
  if (nudge.sent_at) return { ok: false as const, status: 400, error: "Nudge has already been sent." };
  if (nudge.suppressed_at) return { ok: false as const, status: 400, error: "Nudge is suppressed." };
  if (!nudge.user_email) return { ok: false as const, status: 400, error: "Nudge user does not have an email address." };
  if (!nudge.subject || !nudge.message) return { ok: false as const, status: 400, error: "Nudge is missing subject or message." };

  const suppression = await isSuppressed({ userId: nudge.user_id, email: nudge.user_email });
  if (suppression.suppressed) {
    await updateNudgeStatus({ id: input.id, status: "suppressed", adminUserId: input.adminUserId });
    return { ok: false as const, status: 409, error: "Recipient is suppressed." };
  }

  const result = await sendNudgeEmail({ to: nudge.user_email, subject: nudge.subject, message: nudge.message });
  if (!result.ok) return { ok: false as const, status: 500, error: result.error };

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("nudge_events")
    .update({
      status: "sent",
      sent_at: now,
      metadata_json: {
        ...(nudge.metadata_json || {}),
        resend_id_present: Boolean(result.providerId),
        unsubscribe_route: "unresolved",
      },
    })
    .eq("id", input.id)
    .eq("status", "reviewed")
    .is("sent_at", null);
  if (error) throw error;

  const { error: auditError } = await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "nudge_sent",
    target_type: "nudge_event",
    target_id: input.id,
    metadata_json: { provider: "resend", provider_id_present: Boolean(result.providerId) },
  });
  if (auditError) throw auditError;

  return { ok: true as const };
}

export const noStoreHeaders = NO_STORE;
