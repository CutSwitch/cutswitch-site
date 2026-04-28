export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getUserFromBearerToken } from "@/lib/auth";
import { getBaseUrl } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { user, error: authError } = await getUserFromBearerToken(req);

  if (authError === "missing_token") {
    return NextResponse.json({ error: "Missing Authorization bearer token" }, { status: 401 });
  }

  if (authError || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id,current_period_end")
    .eq("user_id", user.id)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[billing:portal] Subscription lookup failed", { message: error.message });
    return NextResponse.json({ error: "Subscription lookup failed" }, { status: 500 });
  }

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No active billing account found." }, { status: 400 });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getBaseUrl()}/account`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; message?: string };
    console.error("[billing:portal] Stripe billing portal failed", {
      type: stripeError?.type,
      code: stripeError?.code,
      message: stripeError?.message || (error instanceof Error ? error.message : "Unknown error"),
    });
    return NextResponse.json({ error: "Unable to create billing portal session." }, { status: 500 });
  }
}
