import { Redis } from "@upstash/redis";

export type TrialRecord = {
  device_id: string;
  trial_started_at: string;
  trial_expires_at: string;
  last_seen_at: string;
  app_version?: string;
  build?: string;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

// Vercel + Upstash integration provides KV_REST_API_URL / KV_REST_API_TOKEN.
// (We also accept UPSTASH_REDIS_REST_* for flexibility.)
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? requiredEnv("UPSTASH_REDIS_REST_URL"),
  token: process.env.KV_REST_API_TOKEN ?? requiredEnv("UPSTASH_REDIS_REST_TOKEN"),
});

export function trialKey(deviceId: string) {
  return `trial:${deviceId}`;
}

export async function getTrial(deviceId: string): Promise<TrialRecord | null> {
  const data = await redis.get<TrialRecord>(trialKey(deviceId));
  return (data as TrialRecord) ?? null;
}

export async function putTrial(rec: TrialRecord) {
  await redis.set(trialKey(rec.device_id), rec);
}
