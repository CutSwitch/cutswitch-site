# CutSwitch Backend Surface (Vercel / Next.js)

This repo is primarily a marketing + checkout site, but it also functions as the **operational backend** for CutSwitch licensing and entitlements.

This file documents what exists today (no historical speculation). For deeper detail, read `AI_Context.md`.

---

## What’s included

### Checkout
- Stripe Checkout (monthly/yearly subscriptions + lifetime purchase)
- Stripe Tax enabled (`automatic_tax`, `tax_id_collection`)
- Coupon support via Stripe Promotion Codes
- Affiliate attribution via Rewardful (referral forwarded via `client_reference_id`)

### Webhooks (server authority)
- `/api/webhooks/stripe`
  - `checkout.session.completed` → provision Keygen license + deliver license email
  - `invoice.paid` → reinstate license
  - `invoice.payment_failed` → suspend license
  - `customer.subscription.deleted` → suspend license
  - `charge.refunded` → suspend license
  - `charge.dispute.created` → suspend license
  - `charge.dispute.closed` (won) → reinstate license
- `/api/webhooks/rewardful`
  - token-gated + HMAC verified (disabled if `REWARDFUL_WEBHOOK_TOKEN` is unset)

### Entitlements API (used by the macOS app)
- `GET /api/entitlement/status?device_id=...&app_version=...&force=1` (canonical)
- `GET /api/entitlement?device_id=...` (legacy wrapper with extra legacy fields)
- `POST /api/entitlement/activate` (Keygen validate + machine activation)

### Trial API
- `POST /api/trial/start`
- `GET /api/trial/status`

### License helpers (optional UI support)
- `GET /api/license/status`
- `POST /api/license/machines`
- `POST /api/license/deactivate`

### Abuse protection
- KV-backed fixed-window rate limits on abuse-prone endpoints.
- JSON payload size limits on POST endpoints.
- No raw payload logging (no secrets, no full PII).

---

## Environment variables

See `ENV_VARS.md` for the exhaustive list. High-level:

Required (prod):
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`, `STRIPE_PRICE_ID_LIFETIME`
- Keygen: `KEYGEN_ACCOUNT_ID`, `KEYGEN_POLICY_ID`, and (`KEYGEN_API_TOKEN` or `KEYGEN_API_KEY`)
- Vercel KV (attached in Vercel project): `KV_*` vars injected automatically

Recommended:
- Resend: `RESEND_API_KEY`, `RESEND_FROM`
- Rewardful: `NEXT_PUBLIC_REWARDFUL_API_KEY`, `REWARDFUL_WEBHOOK_TOKEN`
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DOWNLOAD_URL_MAC`
- Optional: `ENTITLEMENT_SIGNING_KEY` (adds short-lived signed token to entitlement responses)

---

## Operational invariants

- **Idempotency**: Stripe webhook uses KV lock + durable checkout session record. Retried events must not double-provision or double-email.
- **Server authority**: the macOS app can cache, but entitlement decisions come from server and must be revalidated periodically.
- **Stripe metadata never uses `undefined`**: set string/number/null only.

