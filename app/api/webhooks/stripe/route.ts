import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, getStripeWebhookSecret } from "@/lib/stripe";
import { createLicense, reinstateLicense, suspendLicense } from "@/lib/keygen";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, getStripeWebhookSecret());
  } catch (err: any) {
    console.error("stripe webhook signature verify failed", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
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
    console.error("stripe webhook handler error", event.type, err);
    // Return 200 to prevent repeated retries while you debug.
    // In production, you may want to return a 500 to retry transient errors.
    return NextResponse.json({ received: true, error: "handler_error" });
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // This event fires for both one-time payments and subscriptions.
      const planKey = session.metadata?.plan || (session.mode === "subscription" ? "subscription" : session.mode);
  console.log("[stripe] checkout.session.completed", { id: session.id, mode: session.mode, planKey });

  if (session.mode === "subscription") {
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Idempotency: store Keygen license ID in subscription metadata.
    const existing = subscription.metadata?.keygen_license_id;
    if (existing) {
      console.log("[stripe] license already provisioned for subscription", subscriptionId, existing);
      return;
    }

    const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
    const email =
      session.customer_details?.email ||
      session.customer_email ||
      (typeof subscription.customer === "string" ? await lookupCustomerEmail(subscription.customer) : null);

    const referral = typeof session.client_reference_id === "string" ? session.client_reference_id : "";

    const license = await createLicense({
      metadata: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        plan: subscription.metadata?.plan || session.metadata?.plan || "subscription",
        referral: referral || undefined,
        customer_email: email || undefined,
      },
      // Enforced primarily via the Keygen policy activation limits (recommended: max machines = 2).
      maxMachinesOverride: 2,
      name: email ? `CutSwitch (${email})` : undefined,
    });

    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        ...subscription.metadata,
        keygen_license_id: license.id,
        keygen_license_key_last6: license.attributes.key.slice(-6),
      },
    });

    await emailLicense({
      email,
      licenseKey: license.attributes.key,
      planLabel: subscription.metadata?.plan || session.metadata?.plan || "Subscription",
      subscriptionId,
      customerId,
    });
  }

  if (session.mode === "payment") {
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    if (!paymentIntentId) return;

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    const existing = pi.metadata?.keygen_license_id;
    if (existing) {
      console.log("[stripe] license already provisioned for payment_intent", paymentIntentId, existing);
      return;
    }

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const email = session.customer_details?.email || session.customer_email || null;
    const referral = typeof session.client_reference_id === "string" ? session.client_reference_id : "";

    const license = await createLicense({
      metadata: {
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntentId,
        plan: session.metadata?.plan || "lifetime",
        referral: referral || undefined,
        customer_email: email || undefined,
      },
      maxMachinesOverride: 2,
      name: email ? `CutSwitch (${email})` : undefined,
    });

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...pi.metadata,
        keygen_license_id: license.id,
        keygen_license_key_last6: license.attributes.key.slice(-6),
      },
    });

    await emailLicense({
      email,
      licenseKey: license.attributes.key,
      planLabel: session.metadata?.plan || "Lifetime",
      customerId,
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] invoice.paid -> reinstate license", licenseId);
  await reinstateLicense(licenseId);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] invoice.payment_failed -> suspend license", licenseId);
  await suspendLicense(licenseId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const licenseId = subscription.metadata?.keygen_license_id;
  if (!licenseId) return;

  console.log("[stripe] subscription.deleted -> suspend license", licenseId);
  await suspendLicense(licenseId);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // Refunds are not offered, but if a refund happens (manual or forced), suspend access.
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const licenseId = pi.metadata?.keygen_license_id;

  if (licenseId) {
    console.log("[stripe] charge.refunded -> suspend license", licenseId);
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
        console.log("[stripe] dispute.created -> suspend subscription license", licenseId);
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
    console.log("[stripe] dispute.created -> suspend license", licenseId);
    await suspendLicense(licenseId);
  }
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  // If dispute is won, consider reinstating (optional).
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
        console.log("[stripe] dispute.won -> reinstate subscription license", licenseId);
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
    console.log("[stripe] dispute.won -> reinstate license", licenseId);
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
  licenseKey: string;
  planLabel: string;
  subscriptionId?: string;
  customerId?: string | null;
}) {
  const { email, licenseKey, planLabel } = params;
  if (!email) {
    console.log("[email] missing customer email, cannot deliver license key", {
      planLabel,
      customerId: params.customerId,
      subscriptionId: params.subscriptionId,
    });
    return;
  }

  const baseUrl = getBaseUrl();

  let portalUrl: string | null = null;
  if (params.customerId) {
    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: `${baseUrl}/account`,
      });
      portalUrl = portal.url;
    } catch (err) {
      console.log("[stripe] billing portal not configured yet (optional)", err);
    }
  }

  const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC || `${baseUrl}/download`;

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.6;">
      <h2>Thanks for purchasing CutSwitch</h2>
      <p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>

      <p>Your license key:</p>
      <pre style="padding:12px;border-radius:10px;background:#0E1020;color:#B9C0FF;border:1px solid rgba(255,255,255,0.12);font-size:14px;">${escapeHtml(
        licenseKey
      )}</pre>

      <p>Download: <a href="${downloadUrl}">${downloadUrl}</a></p>

      <p><strong>Device limit:</strong> 2 active Macs per license.</p>

      <p><strong>No refunds:</strong> All sales are final. If you have issues, contact support at <a href="mailto:${siteConfig.emails.support}">${siteConfig.emails.support}</a>.</p>

      ${
        portalUrl
          ? `<p>Manage subscription: <a href="${portalUrl}">${portalUrl}</a></p>`
          : `<p>Manage subscription: visit <a href="${baseUrl}/account">${baseUrl}/account</a></p>`
      }

      <p style="opacity:0.75;font-size:12px;">If you did not make this purchase, contact us immediately.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Your CutSwitch license key",
    html,
    text: `Thanks for purchasing CutSwitch.\n\nPlan: ${planLabel}\nLicense key: ${licenseKey}\nDownload: ${downloadUrl}\n\nDevice limit: 2 Macs per license.\nNo refunds. Support: ${siteConfig.emails.support}`,
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
