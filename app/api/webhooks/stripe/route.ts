import { NextResponse } from "next/server";
import Stripe from "stripe";
import { kv } from "@vercel/kv";

import { stripe, getStripePrices, getStripeWebhookSecret } from "@/lib/stripe";
import {
  createLicense,
  reinstateLicense,
  retrieveLicense,
  suspendLicense,
  type KeygenLicense,
} from "@/lib/keygen";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { planLabels, siteConfig, type PlanKey } from "@/lib/site";

export const runtime = "nodejs";

type CheckoutProvisioningRecord = {
  session_id: string;
  stripe_event_id?: string;

  mode?: Stripe.Checkout.Session.Mode;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_payment_intent_id?: string | null;

  stripe_price_id?: string | null;
  plan_key?: PlanKey | "unknown";
  keygen_policy_id?: string | null;

  keygen_license_id?: string | null;
  license_created_in_this_session?: boolean;

  email_sent?: boolean;
  email_sent_at?: string | null;

  completed?: boolean;
  created_at: string;
  updated_at: string;
};

const CHECKOUT_IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, getStripeWebhookSecret());
  } catch (err: any) {
    console.error("[stripe:webhook] signature verification failed", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.id, event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      default:
        // Keep the webhook lean. Add more events as needed.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Return 500 so Stripe retries transient failures. Our KV + Stripe metadata are idempotent.
    console.error("[stripe:webhook] handler error", {
      type: event.type,
      message: err?.message || String(err),
    });
    return NextResponse.json({ received: false, error: "handler_error" }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(eventId: string, session: Stripe.Checkout.Session) {
  const nowIso = new Date().toISOString();

  const sessionId = session.id;
  const kvKey = `stripe:checkout_session:${sessionId}`;
  const lockKey = `${kvKey}:lock`;

  // Concurrency guard: Stripe can deliver the same event multiple times in parallel.
  const lock = await kv.set(lockKey, nowIso, { nx: true, ex: 120 });
  if (!lock) return;

  try {
    const existing = (await kv.get<CheckoutProvisioningRecord>(kvKey)) ?? null;
    if (existing?.completed) return;

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    const priceId = await getPrimaryPriceId(sessionId);
    const planKey = inferPlanKey(priceId, session.metadata?.plan ?? null);
    const policyId = getKeygenPolicyId(planKey);

    const email =
      session.customer_details?.email ||
      session.customer_email ||
      (customerId ? await lookupCustomerEmail(customerId) : null);

    const baseRecord: CheckoutProvisioningRecord = {
      session_id: sessionId,
      stripe_event_id: eventId,
      mode: session.mode,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_price_id: priceId,
      plan_key: planKey,
      keygen_policy_id: policyId,
      keygen_license_id: existing?.keygen_license_id ?? null,
      license_created_in_this_session: existing?.license_created_in_this_session ?? false,
      email_sent: existing?.email_sent ?? false,
      email_sent_at: existing?.email_sent_at ?? null,
      completed: existing?.completed ?? false,
      created_at: existing?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    await kv.set(kvKey, baseRecord, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });

    // We only provision once per session.
    if (session.mode === "subscription") {
      if (!subscriptionId) {
        await markCompleted(kvKey, baseRecord);
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const existingLicenseId = subscription.metadata?.keygen_license_id;

      const customerPolicyKey = customerId && policyId ? `stripe:customer:${customerId}:policy:${policyId}:license` : null;
      const mappedLicenseId = customerPolicyKey ? ((await kv.get<string>(customerPolicyKey)) ?? null) : null;

      const licenseId = baseRecord.keygen_license_id || existingLicenseId || mappedLicenseId;

      if (licenseId) {
        // Ensure Stripe metadata is set (for future suspension/reinstate events).
        if (!existingLicenseId) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: {
              ...subscription.metadata,
              keygen_license_id: licenseId,
            },
          });
        }

        if (customerPolicyKey && !mappedLicenseId) {
          await kv.set(customerPolicyKey, licenseId, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });
        }

        // Only email if this session created the license AND we haven't emailed yet.
        if (baseRecord.license_created_in_this_session && !baseRecord.email_sent) {
          const license = await retrieveLicense(licenseId);
          await emailLicense({
            email,
            license,
            planKey,
            customerId,
            subscriptionId,
          });
          await kv.set(
            kvKey,
            {
              ...baseRecord,
              keygen_license_id: licenseId,
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed: true,
            },
            { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS }
          );
          return;
        }

        await markCompleted(kvKey, { ...baseRecord, keygen_license_id: licenseId });
        return;
      }

      // Create a license for this subscription.
      const referral = typeof session.client_reference_id === "string" ? session.client_reference_id : "";
      const license = await createLicense({
        policyIdOverride: policyId ?? undefined,
        metadata: {
          stripe_checkout_session_id: sessionId,
          stripe_event_id: eventId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          plan: planKey,
          referral: referral || undefined,
          customer_email: email || undefined,
        },
        maxMachinesOverride: 2,
        name: email ? `CutSwitch (${email})` : undefined,
      });

      const nextRecord: CheckoutProvisioningRecord = {
        ...baseRecord,
        keygen_license_id: license.id,
        license_created_in_this_session: true,
        updated_at: new Date().toISOString(),
      };
      await kv.set(kvKey, nextRecord, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });

      if (customerPolicyKey) {
        await kv.set(customerPolicyKey, license.id, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });
      }

      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...subscription.metadata,
          keygen_license_id: license.id,
          keygen_license_key_last6: license.attributes.key.slice(-6),
          plan: subscription.metadata?.plan || (planKey !== "unknown" ? planKey : undefined),
        },
      });

      await emailLicense({
        email,
        license,
        planKey,
        customerId,
        subscriptionId,
      });

      await kv.set(
        kvKey,
        {
          ...nextRecord,
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed: true,
        },
        { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS }
      );

      return;
    }

    if (session.mode === "payment") {
      if (!paymentIntentId) {
        await markCompleted(kvKey, baseRecord);
        return;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      const existingLicenseId = pi.metadata?.keygen_license_id;

      const customerPolicyKey = customerId && policyId ? `stripe:customer:${customerId}:policy:${policyId}:license` : null;
      const mappedLicenseId = customerPolicyKey ? ((await kv.get<string>(customerPolicyKey)) ?? null) : null;

      const licenseId = baseRecord.keygen_license_id || existingLicenseId || mappedLicenseId;

      if (licenseId) {
        if (!existingLicenseId) {
          await stripe.paymentIntents.update(paymentIntentId, {
            metadata: {
              ...pi.metadata,
              keygen_license_id: licenseId,
            },
          });
        }

        if (customerPolicyKey && !mappedLicenseId) {
          await kv.set(customerPolicyKey, licenseId, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });
        }

        // Only email if this session created the license AND we haven't emailed yet.
        if (baseRecord.license_created_in_this_session && !baseRecord.email_sent) {
          const license = await retrieveLicense(licenseId);
          await emailLicense({
            email,
            license,
            planKey,
            customerId,
          });
          await kv.set(
            kvKey,
            {
              ...baseRecord,
              keygen_license_id: licenseId,
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed: true,
            },
            { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS }
          );
          return;
        }

        await markCompleted(kvKey, { ...baseRecord, keygen_license_id: licenseId });
        return;
      }

      const referral = typeof session.client_reference_id === "string" ? session.client_reference_id : "";

      const license = await createLicense({
        policyIdOverride: policyId ?? undefined,
        metadata: {
          stripe_checkout_session_id: sessionId,
          stripe_event_id: eventId,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_price_id: priceId,
          plan: planKey,
          referral: referral || undefined,
          customer_email: email || undefined,
        },
        maxMachinesOverride: 2,
        name: email ? `CutSwitch (${email})` : undefined,
      });

      const nextRecord: CheckoutProvisioningRecord = {
        ...baseRecord,
        keygen_license_id: license.id,
        license_created_in_this_session: true,
        updated_at: new Date().toISOString(),
      };
      await kv.set(kvKey, nextRecord, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });

      if (customerPolicyKey) {
        await kv.set(customerPolicyKey, license.id, { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS });
      }

      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...pi.metadata,
          keygen_license_id: license.id,
          keygen_license_key_last6: license.attributes.key.slice(-6),
          plan: pi.metadata?.plan || (planKey !== "unknown" ? planKey : undefined),
        },
      });

      await emailLicense({
        email,
        license,
        planKey,
        customerId,
      });

      await kv.set(
        kvKey,
        {
          ...nextRecord,
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed: true,
        },
        { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS }
      );

      return;
    }

    // Unexpected mode
    await markCompleted(kvKey, baseRecord);
  } finally {
    await kv.del(lockKey);
  }
}

async function markCompleted(kvKey: string, record: CheckoutProvisioningRecord) {
  await kv.set(
    kvKey,
    {
      ...record,
      completed: true,
      updated_at: new Date().toISOString(),
    },
    { ex: CHECKOUT_IDEMPOTENCY_TTL_SECONDS }
  );
}

async function getPrimaryPriceId(sessionId: string): Promise<string | null> {
  try {
    const li = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 10 });
    const first = li.data?.[0];
    const price: any = (first as any)?.price;
    if (!price) return null;
    if (typeof price === "string") return price;
    if (typeof price?.id === "string") return price.id;
    return null;
  } catch {
    return null;
  }
}

function inferPlanKey(priceId: string | null, metadataPlan: string | null): PlanKey | "unknown" {
  const prices = getStripePrices();

  if (priceId) {
    if (priceId === prices.monthly) return "monthly";
    if (priceId === prices.yearly) return "yearly";
    if (priceId === prices.lifetime) return "lifetime";
  }

  if (metadataPlan === "monthly" || metadataPlan === "yearly" || metadataPlan === "lifetime") {
    return metadataPlan;
  }

  return "unknown";
}

function getKeygenPolicyId(planKey: PlanKey | "unknown"): string | null {
  // Allow per-plan policy ids; fallback to KEYGEN_POLICY_ID.
  // This keeps the integration backward compatible while enabling stricter separation.
  const fallback = process.env.KEYGEN_POLICY_ID || null;

  if (planKey === "monthly") return process.env.KEYGEN_POLICY_ID_MONTHLY || fallback;
  if (planKey === "yearly") return process.env.KEYGEN_POLICY_ID_YEARLY || fallback;
  if (planKey === "lifetime") return process.env.KEYGEN_POLICY_ID_LIFETIME || fallback;

  return fallback;
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] invoice.paid -> reinstate license", { licenseLast6: licenseId.slice(-6) });
  await reinstateLicense(licenseId);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] invoice.payment_failed -> suspend license", { licenseLast6: licenseId.slice(-6) });
  await suspendLicense(licenseId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] subscription.deleted -> suspend license", { licenseLast6: licenseId.slice(-6) });
  await suspendLicense(licenseId);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Refunds are not offered, but if a refund happens (manual or forced), suspend access.
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const licenseId = pi.metadata?.keygen_license_id;

  if (licenseId) {
    console.log("[stripe] charge.refunded -> suspend license", { licenseLast6: licenseId.slice(-6) });
    await suspendLicense(licenseId);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  // Conservative: suspend access when a dispute is opened.
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
  if (!chargeId) return;

  const charge = await stripe.charges.retrieve(chargeId);

  // Prefer subscription mapping if possible.
  if (typeof charge.invoice === "string") {
    const invoice = await stripe.invoices.retrieve(charge.invoice);
    if (typeof invoice.subscription === "string") {
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const licenseId = sub.metadata?.keygen_license_id;
      if (licenseId) {
        console.log("[stripe] dispute.created -> suspend subscription license", {
          licenseLast6: licenseId.slice(-6),
        });
        await suspendLicense(licenseId);
        return;
      }
    }
  }

  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const licenseId = pi.metadata?.keygen_license_id;
  if (licenseId) {
    console.log("[stripe] dispute.created -> suspend license", { licenseLast6: licenseId.slice(-6) });
    await suspendLicense(licenseId);
  }
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  // If dispute is won, consider reinstating.
  if (dispute.status !== "won") return;

  const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
  if (!chargeId) return;

  const charge = await stripe.charges.retrieve(chargeId);

  if (typeof charge.invoice === "string") {
    const invoice = await stripe.invoices.retrieve(charge.invoice);
    if (typeof invoice.subscription === "string") {
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const licenseId = sub.metadata?.keygen_license_id;
      if (licenseId) {
        console.log("[stripe] dispute.won -> reinstate subscription license", {
          licenseLast6: licenseId.slice(-6),
        });
        await reinstateLicense(licenseId);
        return;
      }
    }
  }

  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const licenseId = pi.metadata?.keygen_license_id;
  if (licenseId) {
    console.log("[stripe] dispute.won -> reinstate license", { licenseLast6: licenseId.slice(-6) });
    await reinstateLicense(licenseId);
  }
}

async function lookupCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !("deleted" in customer) && customer.email) return customer.email;
    return null;
  } catch {
    return null;
  }
}

async function emailLicense(params: {
  email: string | null;
  license: KeygenLicense;
  planKey: PlanKey | "unknown";
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  const { email, license, planKey } = params;
  if (!email) {
    console.log("[stripe] customer email missing, cannot deliver license", {
      session: params.subscriptionId ? "subscription" : "payment",
      customerId: params.customerId ? "present" : "missing",
    });
    return;
  }

  const baseUrl = getBaseUrl();

  const planLabel = planKey !== "unknown" ? planLabels[planKey] : "CutSwitch";

  let portalUrl: string | null = null;
  if (params.customerId) {
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: `${baseUrl}/account`,
      });
      portalUrl = portal.url;
    } catch {
      // Optional: billing portal might not be configured.
    }
  }

  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC || `${baseUrl}/download`;

  const activationGuide = `
1) Download CutSwitch: ${downloadUrl}
2) Open the app and paste your license key when prompted.
3) You're licensed on up to 2 Macs per key.

If you run into issues, contact ${siteConfig.emails.support}.
`.trim();

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6;">
      <h2>Thanks for purchasing CutSwitch</h2>
      <p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>

      <p>Your license key:</p>
      <pre style="padding:12px;border-radius:10px;background:#0E1020;color:#B9C0FF;border:1px solid rgba(255,255,255,0.12);font-size:14px;">${escapeHtml(
        license.attributes.key
      )}</pre>

      <p><strong>Activation</strong></p>
      <ol>
        <li>Download CutSwitch: <a href="${downloadUrl}">${downloadUrl}</a></li>
        <li>Open the app and paste your license key when prompted.</li>
        <li>Your license allows up to <strong>2 active Macs</strong>.</li>
      </ol>

      ${
        portalUrl
          ? `<p>Manage subscription: <a href="${portalUrl}">${portalUrl}</a></p>`
          : `<p>Manage subscription: visit <a href="${baseUrl}/account">${baseUrl}/account</a></p>`
      }

      <p style="opacity:0.8;font-size:12px;">No refunds. If you did not make this purchase, contact support immediately.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Your CutSwitch license key",
    html,
    text: `Thanks for purchasing CutSwitch.\n\nPlan: ${planLabel}\nLicense key: ${license.attributes.key}\n\n${activationGuide}\n\nSupport: ${siteConfig.emails.support}`,
    replyTo: siteConfig.emails.support,
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
