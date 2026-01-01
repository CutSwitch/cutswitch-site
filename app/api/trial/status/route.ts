import { NextResponse } from 'next/server';
import { getTrial, putTrial } from '@/lib/kv';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const device_id = String(searchParams.get('device_id') ?? '').trim();

    if (!device_id) {
      return NextResponse.json({ error: 'Missing device_id' }, { status: 400 });
    }

    const now = new Date();
    const existing = await getTrial(device_id);

    if (!existing) {
      return NextResponse.json({ status: 'trial_not_started', server_time: now.toISOString() });
    }

    const rec = { ...existing, last_seen_at: now.toISOString() };
    await putTrial(rec);

    const expired = new Date(rec.trial_expires_at).getTime() <= now.getTime();
    return NextResponse.json({
      status: expired ? 'trial_expired' : 'trial',
      trial_started_at: rec.trial_started_at,
      trial_expires_at: rec.trial_expires_at,
      server_time: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
