import { kv } from '@vercel/kv';

export type TrialRecord = {
  device_id: string;
  trial_started_at: string;
  trial_expires_at: string;
  last_seen_at: string;
  app_version?: string;
  build?: string;
};

export function trialKey(deviceId: string) {
  return `trial:${deviceId}`;
}

export async function getTrial(deviceId: string): Promise<TrialRecord | null> {
  const data = await kv.get<TrialRecord>(trialKey(deviceId));
  return data ?? null;
}

export async function putTrial(rec: TrialRecord) {
  await kv.set(trialKey(rec.device_id), rec);
}
