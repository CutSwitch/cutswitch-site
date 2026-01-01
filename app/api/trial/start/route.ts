import { NextResponse } from 'next/server';
import { getTrial, putTrial, TrialRecord } from '@/lib/kv';

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? '7');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const device_id = String(body.device_id ?? '').trim();
    const app_version = body.app_version ? String(body.app_version) : undefined;
    const build = body.build ? String(body.build) : undefined;

    if (!device_id) {
      return NextResponse.json({ error: 'Missing device_id' }, { status: 400 });
    }

    const now = new Date();
    const existing = await getTrial(device_id);

    if (existing) {
      const rec: TrialRecord = { ...existing, last_seen_at: now.toISOString() };
      await putTrial(rec);
      return NextResponse.json({
        status: 'trial',
        trial_started_at: rec.trial_started_at,
        trial_expires_at: rec.trial_expires_at,
        server_time: now.toISOString(),
      });
    }

    const expires = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const rec: TrialRecord = {
      device_id,
      trial_started_at: now.toISOString(),
      trial_expires_at: expires.toISOString(),
      last_seen_at: now.toISOString(),
      app_version,
      build,
    };
    await putTrial(rec);

    return NextResponse.json({
      status: 'trial',
      trial_started_at: rec.trial_started_at,
      trial_expires_at: rec.trial_expires_at,
      server_time: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
