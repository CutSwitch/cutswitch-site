import { unstable_noStore as noStore } from "next/cache";

import { sendCampaignEmail } from "@/lib/admin/nudgeEmail";
import { getAllAdminUserRows, type AdminUserRow } from "@/lib/admin/data";
import { getAdminSegments } from "@/lib/admin/segments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const CAMPAIGN_SEGMENTS = [
  "trial_never_ran",
  "imported_not_completed",
  "failed_twice",
  "near_quota",
  "heavy_users",
  "love_signals",
  "canceled_users",
] as const;

export type CampaignSegmentKey = (typeof CAMPAIGN_SEGMENTS)[number];
export type CampaignStatus = "draft" | "reviewed" | "sending" | "sent" | "canceled";
export type RecipientStatus = "pending" | "suppressed" | "invalid" | "sent" | "failed" | "skipped";

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  body_markdown: string;
  segment_key: CampaignSegmentKey;
  status: CampaignStatus;
  created_by: string | null;
  created_at: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
};

export type EmailCampaignRecipient = {
  id: string;
  campaign_id: string;
  user_id: string | null;
  email: string;
  status: RecipientStatus;
  suppression_reason: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string | null;
};

const MAX_CAMPAIGN_RECIPIENTS = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isMissingCampaignSchema(error: { code?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

export function campaignSegmentLabel(key: string) {
  const labels: Record<string, string> = {
    trial_never_ran: "Trial never ran",
    imported_not_completed: "Imported, no complete",
    failed_twice: "Failed twice",
    near_quota: "Near quota",
    heavy_users: "Heavy users",
    love_signals: "Love signals",
    canceled_users: "Canceled users",
  };
  return labels[key] || key.replace(/_/g, " ");
}

function isCampaignSegment(value: unknown): value is CampaignSegmentKey {
  return CAMPAIGN_SEGMENTS.includes(value as CampaignSegmentKey);
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || "";
}

async function getSuppressionMap(rows: Array<{ id: string; email: string | null }>) {
  const emails = [...new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean))];
  const userIds = rows.map((row) => row.id).filter(Boolean);
  const map = new Map<string, string>();
  if (!emails.length && !userIds.length) return map;

  const rowsFound: Array<{ user_id: string | null; email: string; reason: string | null }> = [];
  if (emails.length) {
    const { data, error } = await supabaseAdmin
      .from("email_suppressions")
      .select("user_id,email,reason")
      .in("email", emails)
      .returns<Array<{ user_id: string | null; email: string; reason: string | null }>>();
    if (error) {
      if (isMissingCampaignSchema(error)) return map;
      throw error;
    }
    rowsFound.push(...(data || []));
  }
  if (userIds.length) {
    const { data, error } = await supabaseAdmin
      .from("email_suppressions")
      .select("user_id,email,reason")
      .in("user_id", userIds)
      .returns<Array<{ user_id: string | null; email: string; reason: string | null }>>();
    if (error) {
      if (isMissingCampaignSchema(error)) return map;
      throw error;
    }
    rowsFound.push(...(data || []));
  }

  for (const suppression of rowsFound) {
    const reason = suppression.reason || "Suppressed";
    if (suppression.user_id) map.set(`user:${suppression.user_id}`, reason);
    map.set(`email:${normalizeEmail(suppression.email)}`, reason);
  }
  return map;
}

async function resolveSegmentUsers(segmentKey: CampaignSegmentKey) {
  if (segmentKey === "canceled_users") {
    const users = await getAllAdminUserRows();
    return users.filter((user) => user.subscription_status === "canceled");
  }

  const mappedKey = segmentKey === "heavy_users" ? "heavy_user" : segmentKey === "love_signals" ? "positive_feedback" : segmentKey;
  const segments = await getAdminSegments();
  const segment = segments.find((item) => item.key === mappedKey);
  return segment?.rows || [];
}

export async function getCampaignPreview(segmentKey: string) {
  noStore();
  if (!isCampaignSegment(segmentKey)) return { ok: false as const, error: "Invalid segment." };
  const rows = (await resolveSegmentUsers(segmentKey)).slice(0, MAX_CAMPAIGN_RECIPIENTS);
  const suppressionMap = await getSuppressionMap(rows);
  const recipients = rows.map((user) => {
    const email = normalizeEmail(user.email);
    const suppressionReason = suppressionMap.get(`user:${user.id}`) || suppressionMap.get(`email:${email}`) || null;
    const status: RecipientStatus = !EMAIL_RE.test(email) ? "invalid" : suppressionReason ? "suppressed" : "pending";
    return {
      user_id: user.id,
      email,
      status,
      suppression_reason: suppressionReason,
      plan: user.plan,
      subscription_status: user.subscription_status,
      last_active_at: user.last_active_at,
    };
  });

  return {
    ok: true as const,
    segmentKey,
    label: campaignSegmentLabel(segmentKey),
    total: rows.length,
    sendable: recipients.filter((row) => row.status === "pending").length,
    suppressed: recipients.filter((row) => row.status === "suppressed").length,
    invalid: recipients.filter((row) => row.status === "invalid").length,
    recipients,
  };
}

export async function createCampaign(input: {
  name: string;
  subject: string;
  bodyMarkdown: string;
  segmentKey: string;
  adminUserId: string;
}) {
  noStore();
  if (!isCampaignSegment(input.segmentKey)) return { ok: false as const, status: 400, error: "Invalid segment." };
  const name = input.name.trim().slice(0, 160);
  const subject = input.subject.trim().slice(0, 180);
  const bodyMarkdown = input.bodyMarkdown.trim().slice(0, 8000);
  if (!name || !subject || bodyMarkdown.length < 10) return { ok: false as const, status: 400, error: "Campaign name, subject, and body are required." };

  const preview = await getCampaignPreview(input.segmentKey);
  if (!preview.ok) return { ok: false as const, status: 400, error: preview.error };

  const { data: campaign, error } = await supabaseAdmin
    .from("email_campaigns")
    .insert({
      name,
      subject,
      body_markdown: bodyMarkdown,
      segment_key: input.segmentKey,
      status: "draft",
      created_by: input.adminUserId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;

  if (preview.recipients.length) {
    const { error: recipientsError } = await supabaseAdmin.from("email_campaign_recipients").insert(
      preview.recipients.map((recipient) => ({
        campaign_id: campaign.id,
        user_id: recipient.user_id,
        email: recipient.email,
        status: recipient.status,
        suppression_reason: recipient.suppression_reason,
      }))
    );
    if (recipientsError) throw recipientsError;
  }

  await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "email_campaign_created",
    target_type: "email_campaign",
    target_id: campaign.id,
    metadata_json: { segment_key: input.segmentKey, recipient_count: preview.recipients.length, sendable_count: preview.sendable },
  });

  return { ok: true as const, id: campaign.id };
}

export async function getCampaigns() {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("id,name,subject,body_markdown,segment_key,status,created_by,created_at,reviewed_at,sent_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<EmailCampaign[]>();
  if (error) {
    if (isMissingCampaignSchema(error)) return { rows: [] as EmailCampaign[], schemaMissing: true };
    throw error;
  }
  return { rows: data || [], schemaMissing: false };
}

export async function getCampaign(id: string) {
  noStore();
  const { data: campaign, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("id,name,subject,body_markdown,segment_key,status,created_by,created_at,reviewed_at,sent_at")
    .eq("id", id)
    .maybeSingle<EmailCampaign>();
  if (error) throw error;
  if (!campaign) return null;

  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("id,campaign_id,user_id,email,status,suppression_reason,sent_at,error_message,created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true })
    .returns<EmailCampaignRecipient[]>();
  if (recipientsError) throw recipientsError;
  return { campaign, recipients: recipients || [] };
}

export async function reviewCampaign(input: { id: string; adminUserId: string }) {
  const { error } = await supabaseAdmin
    .from("email_campaigns")
    .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("status", "draft");
  if (error) throw error;

  await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "email_campaign_reviewed",
    target_type: "email_campaign",
    target_id: input.id,
  });
}

export async function sendCampaignTest(input: { id: string; adminEmail: string; adminUserId: string }) {
  const result = await getCampaign(input.id);
  if (!result) return { ok: false as const, status: 404, error: "Campaign not found." };
  const send = await sendCampaignEmail({
    to: input.adminEmail,
    subject: `[TEST] ${result.campaign.subject}`,
    message: result.campaign.body_markdown,
  });
  if (!send.ok) return { ok: false as const, status: 500, error: send.error };

  await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "email_campaign_test_sent",
    target_type: "email_campaign",
    target_id: input.id,
    metadata_json: { provider: "resend", provider_id_present: Boolean(send.providerId) },
  });
  return { ok: true as const };
}

async function refreshSuppressedRecipients(campaignId: string, recipients: EmailCampaignRecipient[]) {
  const pending = recipients.filter((recipient) => recipient.status === "pending");
  const suppressionMap = await getSuppressionMap(pending.map((recipient) => ({ id: recipient.user_id || "", email: recipient.email })));
  for (const recipient of pending) {
    const email = normalizeEmail(recipient.email);
    const reason = suppressionMap.get(`user:${recipient.user_id}`) || suppressionMap.get(`email:${email}`) || null;
    if (reason) {
      await supabaseAdmin
        .from("email_campaign_recipients")
        .update({ status: "suppressed", suppression_reason: reason })
        .eq("id", recipient.id);
    }
  }
}

export async function sendReviewedCampaign(input: { id: string; confirmation: string; adminUserId: string }) {
  noStore();
  if (input.confirmation !== "SEND") return { ok: false as const, status: 400, error: "Confirmation text must be SEND." };
  const result = await getCampaign(input.id);
  if (!result) return { ok: false as const, status: 404, error: "Campaign not found." };
  if (result.campaign.status !== "reviewed") return { ok: false as const, status: 400, error: "Campaign must be reviewed before sending." };
  if (result.campaign.sent_at) return { ok: false as const, status: 400, error: "Campaign was already sent." };

  await refreshSuppressedRecipients(input.id, result.recipients);

  const fresh = await getCampaign(input.id);
  if (!fresh) return { ok: false as const, status: 404, error: "Campaign not found." };
  const pending = fresh.recipients.filter((recipient) => recipient.status === "pending").slice(0, MAX_CAMPAIGN_RECIPIENTS);

  const { error: lockError } = await supabaseAdmin
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", input.id)
    .eq("status", "reviewed")
    .is("sent_at", null);
  if (lockError) throw lockError;

  let sent = 0;
  let failed = 0;
  for (const recipient of pending) {
    const email = normalizeEmail(recipient.email);
    if (!EMAIL_RE.test(email)) {
      await supabaseAdmin.from("email_campaign_recipients").update({ status: "invalid", error_message: "Invalid email." }).eq("id", recipient.id);
      continue;
    }
    const send = await sendCampaignEmail({ to: email, subject: fresh.campaign.subject, message: fresh.campaign.body_markdown });
    if (send.ok) {
      sent += 1;
      await supabaseAdmin.from("email_campaign_recipients").update({ status: "sent", sent_at: new Date().toISOString(), error_message: null }).eq("id", recipient.id);
    } else {
      failed += 1;
      await supabaseAdmin.from("email_campaign_recipients").update({ status: "failed", error_message: send.error }).eq("id", recipient.id);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const finalStatus = failed > 0 ? "reviewed" : "sent";
  await supabaseAdmin
    .from("email_campaigns")
    .update({ status: finalStatus, sent_at: failed > 0 ? null : new Date().toISOString() })
    .eq("id", input.id);

  await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "email_campaign_sent",
    target_type: "email_campaign",
    target_id: input.id,
    metadata_json: { attempted: pending.length, sent, failed },
  });

  return { ok: true as const, sent, failed };
}
