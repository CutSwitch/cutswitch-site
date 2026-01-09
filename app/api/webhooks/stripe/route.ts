/* eslint-disable no-console */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, getStripeWebhookSecret, getStripePrices } from "@/lib/stripe";
import { createLicense, reinstateLicense, retrieveLicense, suspendLicense } from "@/lib/keygen";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { kv } from "@vercel/kv";
import type { PlanKey } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe Webhook: server authoritative, idempotent.
 *
 * - Creates Keygen license on first successful purchase (checkout.session.completed)
 * - Stores keygen_license_id on the Stripe subscription/payment_intent metadata
 * - Emails license key ONCE (first delivery only), with KV-backed idempotency to handle Stripe retries safely
 * - Suspends/Reinstates license based on billing events
 */

type CheckoutKvRecord = {
  created_at: string;
  updated_at: string;

  stripe_customer_id?: string | null;
  stripe_checkout_session_id: string;
  stripe_event_id_last?: string;
  stripe_mode?: "subscription" | "payment" | string;

  stripe_subscription_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_price_id?: string | null;

  plan_key?: PlanKey | "unknown";
  keygen_policy_id?: string | null;

  keygen_license_id?: string | null;

  license_created_in_session?: boolean;
  license_created_at?: string;

  email_sent?: boolean;
  email_sent_at?: string;

  completed?: boolean;
  completed_at?: string;
};

const CHECKOUT_KV_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  // Redact emails
  const redactedEmail = msg.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>");
  // Redact long token-like strings (best-effort)
  const redactedTokens = redactedEmail.replace(/[A-Za-z0-9_-]{24,}/g, "<redacted-token>");
  return redactedTokens.slice(0, 500);
}

async function getPriceIdFromSession(sessionId: string): Promise<string | null> {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 10,
  });

  for (const item of lineItems.data) {
    const priceAny = (item as any).price;
    const priceId =
      typeof priceAny === "string"
        ? priceAny
        : typeof priceAny?.id === "string"
          ? priceAny.id
          : null;

    if (priceId) return priceId;
  }

  return null;
}

function derivePlanKey(args: { priceId: string | null; fallbackPlanFromMetadata?: string | null }): PlanKey | "unknown" {
  const prices = getStripePrices();

  if (args.priceId) {
    if (args.priceId === prices.monthly) return "monthly";
    if (args.priceId === prices.yearly) return "yearly";
    if (args.priceId === prices.lifetime) return "lifetime";
  }

  const fallback = (args.fallbackPlanFromMetadata || "").toLowerCase();
  if (fallback === "monthly" || fallback === "yearly" || fallback === "lifetime") return fallback;
  return "unknown";
}

function getKeygenPolicyIdForPlan(planKey: PlanKey | "unknown"): string {
  // Default policy is required by lib/keygen.ts
  const base = process.env.KEYGEN_POLICY_ID || "";

  if (planKey === "monthly") return process.env.KEYGEN_POLICY_ID_MONTHLY || base;
  if (planKey === "yearly") return process.env.KEYGEN_POLICY_ID_YEARLY || base;
  if (planKey === "lifetime") return process.env.KEYGEN_POLICY_ID_LIFETIME || base;

  return base;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "missing_signature_or_secret" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("stripe webhook signature verify failed", safeErrorMessage(err));
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(event.id, session);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        // Ignore other events.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[stripe] webhook handler error", {
      eventType: event.type,
      eventId: event.id,
      message: safeErrorMessage(err),
    });
    // Return non-2xx so Stripe retries. We use KV/metadata idempotency to prevent dupes.
    return NextResponse.json({ received: true, error: "handler_error" }, { status: 500 });
  }
}

async function handleCheckoutSessionCompleted(eventId: string, session: Stripe.Checkout.Session) {
  // KV-backed idempotency/resume for Stripe retries.
  const kvKey = `stripe:checkout:${session.id}`;
  const lockKey = `${kvKey}:lock`;
  const nowIso = new Date().toISOString();

  // Short lock to avoid concurrent double-processing.
  const lock = await kv.set(lockKey, "1", { nx: true, ex: 60 * 2 });
  if (!lock) {
    // Another invocation is currently handling this session.
    return;
  }

  try {
    const existing = (await kv.get<CheckoutKvRecord>(kvKey)) || null;
    if (existing?.completed) return;

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    const priceId = await getPriceIdFromSession(session.id);
    const planKey = derivePlanKey({ priceId, fallbackPlanFromMetadata: session.metadata?.plan || null });
    const planLabel = planKey === "unknown" ? "CutSwitch" : siteConfig.planLabels[planKey];

    const policyId = getKeygenPolicyIdForPlan(planKey);

    const baseRecord: CheckoutKvRecord =
      existing ||
      ({
        created_at: nowIso,
        updated_at: nowIso,
        stripe_checkout_session_id: session.id,
        stripe_event_id_last: eventId,
        stripe_mode: session.mode,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_price_id: priceId,
        plan_key: planKey,
        keygen_policy_id: policyId,
        keygen_license_id: null,
        license_created_in_session: false,
        email_sent: false,
        completed: false,
      } satisfies CheckoutKvRecord);

    // Keep record fresh for debugging/resume.
    await kv.set(
      kvKey,
      {
        ...baseRecord,
        updated_at: nowIso,
        stripe_event_id_last: eventId,
        stripe_mode: session.mode,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_price_id: priceId,
        plan_key: planKey,
        keygen_policy_id: policyId,
      },
      { ex: CHECKOUT_KV_TTL_SECONDS },
    );

    console.log("[stripe] checkout.session.completed", {
      sessionId: session.id,
      mode: session.mode,
      planKey,
      priceId,
    });

    const email = session.customer_details?.email || session.customer_email || null;

    // For subscription checkouts, the actual \"first successful purchase\" is the initial payment.
    // This webhook is already checkout-complete, which is what we want for first email.
    if (session.mode === "subscription") {
      if (!subscriptionId) {
        console.warn("[stripe] missing subscriptionId on subscription checkout", { sessionId: session.id });
        await kv.set(
          kvKey,
          {
            ...baseRecord,
            updated_at: new Date().toISOString(),
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { ex: CHECKOUT_KV_TTL_SECONDS },
        );
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Determine if a license already exists for this purchase.
      let licenseId: string | null = baseRecord.keygen_license_id || null;

      // Prefer Stripe metadata if present (authoritative linkage)
      if (!licenseId && subscription.metadata?.keygen_license_id) {
        licenseId = subscription.metadata.keygen_license_id;
      }

      // Otherwise, check KV mapping per customer+policy (reuse)
      if (!licenseId && customerId) {
        const customerPolicyLicenseKey = `stripe:customer:${customerId}:policy:${policyId}:keygen_license_id`;
        const existingForCustomer = await kv.get<string>(customerPolicyLicenseKey);
        if (existingForCustomer) licenseId = existingForCustomer;
      }

      if (licenseId) {
        // Ensure subscription metadata is linked so future billing events can suspend/reinstate.
        if (!subscription.metadata?.keygen_license_id) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: {
              ...subscription.metadata,
              keygen_license_id: licenseId,
              keygen_license_key_last6: licenseId.slice(-6),
              plan: subscription.metadata?.plan || planKey,
            },
          });
        }

        // If a license was created earlier in THIS checkout flow but email failed, resume email delivery.
        if (baseRecord.license_created_in_session && !baseRecord.email_sent) {
          const lic = await retrieveLicense(licenseId);

          await emailLicense({
            email,
            licenseKey: lic.attributes.key,
            planLabel,
            customerId,
            subscriptionId,
          });

          await kv.set(
            kvKey,
            {
              ...baseRecord,
              updated_at: new Date().toISOString(),
              keygen_license_id: licenseId,
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              completed: true,
              completed_at: new Date().toISOString(),
            },
            { ex: CHECKOUT_KV_TTL_SECONDS },
          );

          return;
        }

        // If we got here: license already existed (reused) and we are not resuming a pending first-delivery email.
        // Do not re-email.
        await kv.set(
          kvKey,
          {
            ...baseRecord,
            updated_at: new Date().toISOString(),
            keygen_license_id: licenseId,
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { ex: CHECKOUT_KV_TTL_SECONDS },
        );
        return;
      }

      // Create a new license and link it to the subscription.
      const license = await createLicense({
        policyIdOverride: policyId || undefined,
        metadata: {
          plan: planKey,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_checkout_session_id: session.id,
          stripe_price_id: priceId,
          customer_email: email,
        },
        maxMachinesOverride: 2,
        name: email ? `CutSwitch (${email})` : "CutSwitch",
      });

      licenseId = license.id;

      // Persist partial progress as soon as the license exists so webhook retries can resume safely.
      await kv.set(
        kvKey,
        {
          ...baseRecord,
          updated_at: new Date().toISOString(),
          keygen_license_id: license.id,
          license_created_in_session: true,
          license_created_at: nowIso,
          email_sent: false,
          completed: false,
        },
        { ex: CHECKOUT_KV_TTL_SECONDS },
      );

      // Save mapping for reuse by customer+policy.
      if (customerId) {
        const customerPolicyLicenseKey = `stripe:customer:${customerId}:policy:${policyId}:keygen_license_id`;
        await kv.set(customerPolicyLicenseKey, license.id, { ex: CHECKOUT_KV_TTL_SECONDS });
      }

      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...subscription.metadata,
          keygen_license_id: license.id,
          keygen_license_key_last6: license.attributes.key.slice(-6),
          plan: subscription.metadata?.plan || planKey,
        },
      });

      await emailLicense({
        email,
        licenseKey: license.attributes.key,
        planLabel,
        customerId,
        subscriptionId,
      });

      // Mark complete.
      await kv.set(
        kvKey,
        {
          ...baseRecord,
          updated_at: new Date().toISOString(),
          keygen_license_id: license.id,
          license_created_in_session: true,
          license_created_at: nowIso,
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { ex: CHECKOUT_KV_TTL_SECONDS },
      );

      return;
    }

    // One-time payment (Lifetime)
    if (session.mode === "payment") {
      if (!paymentIntentId) {
        console.warn("[stripe] missing paymentIntentId on payment checkout", { sessionId: session.id });
        await kv.set(
          kvKey,
          {
            ...baseRecord,
            updated_at: new Date().toISOString(),
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { ex: CHECKOUT_KV_TTL_SECONDS },
        );
        return;
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      let licenseId: string | null = baseRecord.keygen_license_id || null;

      if (!licenseId && pi.metadata?.keygen_license_id) {
        licenseId = pi.metadata.keygen_license_id;
      }

      if (!licenseId && customerId) {
        const customerPolicyLicenseKey = `stripe:customer:${customerId}:policy:${policyId}:keygen_license_id`;
        const existingForCustomer = await kv.get<string>(customerPolicyLicenseKey);
        if (existingForCustomer) licenseId = existingForCustomer;
      }

      if (licenseId) {
        // Ensure PI metadata is linked for refunds/disputes.
        if (!pi.metadata?.keygen_license_id) {
          await stripe.paymentIntents.update(paymentIntentId, {
            metadata: {
              ...pi.metadata,
              keygen_license_id: licenseId,
            },
          });
        }

        // If a license was created earlier in THIS checkout flow but email failed, resume email delivery.
        if (baseRecord.license_created_in_session && !baseRecord.email_sent) {
          const lic = await retrieveLicense(licenseId);

          await emailLicense({
            email,
            licenseKey: lic.attributes.key,
            planLabel,
            customerId,
            paymentIntentId,
          });

          await kv.set(
            kvKey,
            {
              ...baseRecord,
              updated_at: new Date().toISOString(),
              keygen_license_id: licenseId,
              email_sent: true,
              email_sent_at: new Date().toISOString(),
              completed: true,
              completed_at: new Date().toISOString(),
            },
            { ex: CHECKOUT_KV_TTL_SECONDS },
          );

          return;
        }

        // Do not re-email.
        await kv.set(
          kvKey,
          {
            ...baseRecord,
            updated_at: new Date().toISOString(),
            keygen_license_id: licenseId,
            completed: true,
            completed_at: new Date().toISOString(),
          },
          { ex: CHECKOUT_KV_TTL_SECONDS },
        );
        return;
      }

      // Create license for lifetime.
      const license = await createLicense({
        policyIdOverride: policyId || undefined,
        metadata: {
          plan: planKey,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: paymentIntentId,
          stripe_checkout_session_id: session.id,
          stripe_price_id: priceId,
          customer_email: email,
        },
        maxMachinesOverride: 2,
        name: email ? `CutSwitch (${email})` : "CutSwitch",
      });

      licenseId = license.id;

      // Persist partial progress as soon as the license exists so webhook retries can resume safely.
      await kv.set(
        kvKey,
        {
          ...baseRecord,
          updated_at: new Date().toISOString(),
          keygen_license_id: license.id,
          license_created_in_session: true,
          license_created_at: nowIso,
          email_sent: false,
          completed: false,
        },
        { ex: CHECKOUT_KV_TTL_SECONDS },
      );

      if (customerId) {
        const customerPolicyLicenseKey = `stripe:customer:${customerId}:policy:${policyId}:keygen_license_id`;
        await kv.set(customerPolicyLicenseKey, license.id, { ex: CHECKOUT_KV_TTL_SECONDS });
      }

      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: {
          ...pi.metadata,
          keygen_license_id: license.id,
          keygen_license_key_last6: license.attributes.key.slice(-6),
          plan: pi.metadata?.plan || planKey,
        },
      });

      await emailLicense({
        email,
        licenseKey: license.attributes.key,
        planLabel,
        customerId,
        paymentIntentId,
      });

      await kv.set(
        kvKey,
        {
          ...baseRecord,
          updated_at: new Date().toISOString(),
          keygen_license_id: license.id,
          license_created_in_session: true,
          license_created_at: nowIso,
          email_sent: true,
          email_sent_at: new Date().toISOString(),
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { ex: CHECKOUT_KV_TTL_SECONDS },
      );

      return;
    }

    // Unknown mode: mark complete.
    await kv.set(
      kvKey,
      {
        ...baseRecord,
        updated_at: new Date().toISOString(),
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { ex: CHECKOUT_KV_TTL_SECONDS },
    );
  } finally {
    // Release lock quickly (otherwise wait for TTL).
    await kv.del(lockKey);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Suspend license if linked via subscription metadata.
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;

  if (!licenseId) {
    console.warn("[stripe] invoice.payment_failed but no license linked", { subscriptionId });
    return;
  }

  console.log("[stripe] invoice.payment_failed - suspending license", { subscriptionId, licenseId });
  await suspendLicense(licenseId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Reinstate license if linked and previously suspended.
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;

  if (!licenseId) {
    return;
  }

  console.log("[stripe] invoice.paid - reinstating license", { subscriptionId, licenseId });
  await reinstateLicense(licenseId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] subscription.deleted - suspending license", { subscriptionId: subscription.id, licenseId });
  await suspendLicense(licenseId);
}

async function emailLicense(params: {
  email: string | null;
  licenseKey: string;
  planLabel: string;
  customerId: string | null;
  subscriptionId?: string | null;
  paymentIntentId?: string | null;
}) {
  if (!params.email) {
    console.warn("[stripe] cannot email license: missing customer email", {
      customerId: params.customerId,
      subscriptionId: params.subscriptionId || null,
      paymentIntentId: params.paymentIntentId || null,
    });
    return;
  }

  const baseUrl = getBaseUrl();
  const downloadUrl = `${baseUrl}/download`;

  // Optional: billing portal link (works for subscriptions; safe to omit if not configured).
  let portalUrl: string | null = null;
  if (params.customerId) {
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: baseUrl,
      });
      portalUrl = portal.url;
    } catch (err) {
      // Billing portal is optional.
      console.log("[stripe] billing portal not configured yet (optional)", err);
    }
  }

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
      <h2 style="margin:0 0 12px 0;">Your CutSwitch license key</h2>
      <p style="margin:0 0 16px 0;">Thanks for purchasing <strong>${escapeHtml(params.planLabel)}</strong>.</p>

      <p style="margin:0 0 8px 0;">License key:</p>
      <pre style="padding:12px 14px; background:#f3f4f6; border-radius:10px; font-size: 15px; overflow:auto;">${escapeHtml(
        params.licenseKey,
      )}</pre>

      <p>Download: <a href="${downloadUrl}">${downloadUrl}</a></p>

      <h3 style="margin-top:20px;">Activate CutSwitch</h3>
      <ol style="margin-top:8px;padding-left:18px;">
        <li>Download and install CutSwitch from the link above.</li>
        <li>Open CutSwitch and go to <strong>Settings → License</strong> (or the License screen).</li>
        <li>Paste your license key, then click <strong>Activate</strong>.</li>
        <li>You can activate on up to <strong>2 Macs</strong>.</li>
      </ol>

      ${
        portalUrl && params.subscriptionId
          ? `<p style="margin-top:16px;">Manage subscription: <a href="${portalUrl}">${portalUrl}</a></p>`
          : ""
      }

      <p style="margin-top:16px;">Need help? Reply to this email or contact <a href="mailto:${siteConfig.supportEmail}">${siteConfig.supportEmail}</a>.</p>
    </div>
  `.trim();

  const text = [
    `Your CutSwitch license key`,
    ``,
    `Thanks for purchasing ${params.planLabel}.`,
    ``,
    `LICENSE KEY:`,
    params.licenseKey,
    ``,
    `Download: ${downloadUrl}`,
    ``,
    `Activate CutSwitch:`,
    `1) Download and install CutSwitch.`,
    `2) Open CutSwitch and go to Settings → License.`,
    `3) Paste your license key and click Activate.`,
    `4) You can activate on up to 2 Macs.`,
    ``,
    params.subscriptionId && portalUrl ? `Manage subscription: ${portalUrl}` : ``,
    ``,
    `Need help? ${siteConfig.supportEmail}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendEmail({
    to: params.email,
    subject: "Your CutSwitch license key",
    html,
    text,
    replyTo: siteConfig.supportEmail,
  });
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}