import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Placeholder endpoint for Rewardful webhooks (optional).
// Rewardful typically integrates with Stripe directly, but if you enable webhooks,
// point them here and add signature verification + event handling.
export async function POST(req: Request) {
  const raw = await req.text();
  console.log("[rewardful webhook]", raw);

  // TODO: verify signature from Rewardful (if configured) and handle events as needed.
  return NextResponse.json({ received: true });
}
