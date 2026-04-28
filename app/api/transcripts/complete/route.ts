export const runtime = "nodejs";

import crypto from "crypto";

import { getUserFromBearerToken } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TranscriptStatus = "succeeded" | "failed" | "reused";

type CompleteBody = {
  projectFingerprint?: unknown;
  audioFingerprint?: unknown;
  durationSeconds?: unknown;
  speakerCount?: unknown;
  providerJobId?: unknown;
  status?: unknown;
};

function stableHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeFingerprint(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 512) return null;
  return trimmed;
}

function normalizeDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 24 * 60 * 60) return null;
  return Math.ceil(value);
}

function normalizeSpeakerCount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 32) return null;
  return value;
}

function normalizeProviderJobId(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > 512) return null;
  return trimmed || null;
}

function normalizeStatus(value: unknown): TranscriptStatus | null {
  return value === "succeeded" || value === "failed" || value === "reused" ? value : null;
}

async function recordUsageEvent(input: {
  userId: string;
  eventType: "transcript_succeeded" | "transcript_reused";
  billableSeconds: number;
  idempotencyKey: string;
}) {
  const { error } = await supabaseAdmin.from("usage_events").upsert(
    {
      user_id: input.userId,
      event_type: input.eventType,
      billable_seconds: input.billableSeconds,
      idempotency_key: input.idempotencyKey,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true }
  );

  if (error) throw error;
}

async function upsertTranscriptJob(input: {
  userId: string;
  projectFingerprint: string;
  audioFingerprint: string;
  durationSeconds: number;
  speakerCount: number;
  providerJobId: string | null;
  status: TranscriptStatus;
  reuseKey: string;
}) {
  const record = {
    user_id: input.userId,
    project_fingerprint: input.projectFingerprint,
    audio_fingerprint: input.audioFingerprint,
    duration_seconds: input.durationSeconds,
    speaker_count: input.speakerCount,
    provider_job_id: input.providerJobId,
    status: input.status,
    reuse_key: input.reuseKey,
  };

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("transcript_jobs")
    .select("id")
    .eq("user_id", input.userId)
    .eq("reuse_key", input.reuseKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await supabaseAdmin.from("transcript_jobs").update(record).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("transcript_jobs").insert(record);
  if (error) throw error;
}

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return Response.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  if (authError || !user) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const parsed = await readJsonBody<CompleteBody>(req, 16 * 1024);
  if (!parsed.ok) {
    return Response.json({ error: parsed.message || "Invalid request." }, { status: parsed.status });
  }

  const projectFingerprint = normalizeFingerprint(parsed.data.projectFingerprint);
  const audioFingerprint = normalizeFingerprint(parsed.data.audioFingerprint);
  const durationSeconds = normalizeDuration(parsed.data.durationSeconds);
  const speakerCount = normalizeSpeakerCount(parsed.data.speakerCount);
  const providerJobId = normalizeProviderJobId(parsed.data.providerJobId);
  const status = normalizeStatus(parsed.data.status);

  if (!projectFingerprint || !audioFingerprint || !durationSeconds || !speakerCount || !status) {
    return Response.json({ error: "Invalid transcript completion payload." }, { status: 400 });
  }

  const reuseKey = stableHash([user.id, projectFingerprint, audioFingerprint, speakerCount].join(":"));
  const idempotencyKey = stableHash([reuseKey, status].join(":"));

  try {
    const { data: priorSuccess, error: priorSuccessError } = await supabaseAdmin
      .from("transcript_jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("reuse_key", reuseKey)
      .eq("status", "succeeded")
      .limit(1)
      .maybeSingle();

    if (priorSuccessError) throw priorSuccessError;

    if (priorSuccess) {
      if (status === "reused") {
        await recordUsageEvent({
          userId: user.id,
          eventType: "transcript_reused",
          billableSeconds: 0,
          idempotencyKey,
        });
      }

      return Response.json({ ok: true, status: "reused", billableSeconds: 0, reused: true });
    }

    if (status === "failed") {
      await upsertTranscriptJob({
        userId: user.id,
        projectFingerprint,
        audioFingerprint,
        durationSeconds,
        speakerCount,
        providerJobId,
        status,
        reuseKey,
      });

      return Response.json({ ok: true, status, billableSeconds: 0, reused: false });
    }

    if (status === "reused") {
      await recordUsageEvent({
        userId: user.id,
        eventType: "transcript_reused",
        billableSeconds: 0,
        idempotencyKey,
      });

      return Response.json({ ok: true, status, billableSeconds: 0, reused: true });
    }

    await upsertTranscriptJob({
      userId: user.id,
      projectFingerprint,
      audioFingerprint,
      durationSeconds,
      speakerCount,
      providerJobId,
      status,
      reuseKey,
    });

    await recordUsageEvent({
      userId: user.id,
      eventType: "transcript_succeeded",
      billableSeconds: durationSeconds,
      idempotencyKey,
    });

    return Response.json({ ok: true, status, billableSeconds: durationSeconds, reused: false });
  } catch (error) {
    console.error("[transcripts:complete] store failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json({ error: "Unable to record transcript completion." }, { status: 500 });
  }
}
