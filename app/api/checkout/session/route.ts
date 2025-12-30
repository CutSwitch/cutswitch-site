import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      email: session.customer_details?.email || session.customer_email || null,
      mode: session.mode || null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      plan: (session.metadata?.plan as string | undefined) || null,
    });
  } catch (err: any) {
    console.error("session retrieve error", err);
    return NextResponse.json({ error: "Unable to retrieve session" }, { status: 500 });
  }
}
