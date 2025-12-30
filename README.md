# CutSwitch Site (Next.js + Stripe + Stripe Tax + Rewardful + Keygen)

Premium marketing + checkout site for a macOS app.

## What you get
- Next.js App Router (TypeScript, Tailwind)
- Marketing pages: Home, Pricing, Download, Support, Affiliates
- Legal pages: Terms, Privacy, Refund Policy (no refunds)
- Stripe Checkout + Stripe Tax enabled (automatic_tax + tax_id_collection)
- Rewardful attribution (script + referral passthrough via client_reference_id)
- Keygen license provisioning (create license on `checkout.session.completed`)
- License enforcement scaffolding (suspend/reinstate on billing + dispute events)
- Support form endpoint (`/api/support`) + optional Resend email
- Account page flow to email a Stripe Billing Portal link (reduces chargebacks)

## Quick start

1) Install deps
```bash
npm install
```

2) Copy env
```bash
cp .env.example .env.local
```

3) Run
```bash
npm run dev
```

Open http://localhost:3000

## Required env vars (production)
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_*`
- Keygen: `KEYGEN_API_KEY`, `KEYGEN_ACCOUNT_ID`, `KEYGEN_POLICY_ID`
- Rewardful: `NEXT_PUBLIC_REWARDFUL_API_KEY` (+ optional portal URL)
- Download URL: `NEXT_PUBLIC_DOWNLOAD_URL_MAC`

## Webhooks
- Stripe webhook endpoint:
  - `/api/webhooks/stripe`
  - Listen for at least:
    - `checkout.session.completed`
    - `invoice.paid`
    - `invoice.payment_failed`
    - `customer.subscription.deleted`
    - `charge.refunded`
    - `charge.dispute.created`
    - `charge.dispute.closed`

## Notes
- No refunds is enforced as a policy, not a Stripe feature.
- The app must validate Keygen licenses and enforce read-only/trial behavior. The website provisions licenses and updates status.
- For real license delivery, set `RESEND_API_KEY` (optional but recommended).
