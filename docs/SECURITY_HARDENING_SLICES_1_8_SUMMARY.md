# CutSwitch Security Hardening Slices 1-8 — Reconciled Baseline

Last reconciled: 2026-04-30 Pacific/Honolulu  
Production target: `https://cutswitch-site.vercel.app`

This summary reflects the current website/backend repo and production smoke tests. It supersedes any stale notes that said `/api/transcripts/complete` or `/admin` were not present.

## Current Status Table

| Area | Status | Evidence |
|---|---|---|
| Auth/session | Green | Repo has `app/api/app/session/route.ts`; production `POST /api/app/session` returned `200` with token fields present and redacted in smoke output. |
| Token refresh | Green | Repo has `app/api/app/session/refresh/route.ts`; production invalid refresh returned `401`; valid refresh returned `200` with a new access token present. |
| Usage enforcement | Green | Repo has `app/api/account/usage/route.ts` and `app/api/transcripts/complete/route.ts`; production usage returned `200`; transcript success billed test duration, duplicate returned `reused: true` and `0`, failed returned `0`, usage increased only by the successful test duration. |
| Stripe webhooks | Yellow | `app/api/webhooks/stripe/route.ts` verifies `stripe-signature` with raw body via `stripe.webhooks.constructEvent`; checkout completion has KV lock/session idempotency. No `stripe_webhook_events` migration exists, and no live Stripe CLI replay was run in this reconciliation. |
| Admin security | Yellow | Repo has `/admin` pages and `/api/admin/*` routes. Production signed-out `/admin` redirected to `/login?next=%2Fadmin`; unauthenticated admin export returned `401`; bearer admin-status for the test account returned `{"isAdmin":true}`. Full browser cookie-auth admin page access was not verified in this pass. |
| macOS auth hardening | Yellow | Website/backend session + refresh endpoints are present and production-smoked. macOS app Keychain/logging/release-build checks are out of scope for this website repo pass. |

## Repo Baseline

- Repo path inspected: `/Users/jamisonerwin/GitHub/cutswitch-site`
- Git remote from `.git/config`: `https://github.com/CutSwitch/cutswitch-site.git`
- Current branch from `.git/HEAD`: `main`
- Latest commit from `.git/refs/heads/main`: `8360ec42195e69215c387655a1b80ace060317e4` (`security`)
- `git status` could not run because the local machine has not accepted the Xcode license. Exact error: `You have not agreed to the Xcode license agreements.`
- Security docs observed in repo:
  - `docs/security/00_RUN_ORDER.md`
  - `docs/security/01_input_validation_zod_hardening.md`
  - `docs/security/02_webhook_hardening_stripe.md`
  - `docs/security/03_rate_limiting.md`
  - `docs/security/04_logging_privacy_safety.md`
  - `docs/security/05_admin_security_hardening.md`
  - `docs/security/06_abuse_protection_trial_usage.md`
  - `docs/security/07_macos_app_hardening.md`
  - `docs/security/08_token_safety_expiry_handling.md`
  - `docs/security/CutSwitch_Security_Hardening_Plan.md`
- This summary file was missing before reconciliation and has now been added.

## Route Reality Check

| Route/path | Repo status |
|---|---|
| `app/api/app/session/route.ts` | Found |
| `app/api/app/session/refresh/route.ts` | Found |
| `app/api/account/usage/route.ts` | Found |
| `app/api/transcripts/complete/route.ts` | Found |
| `app/api/feedback/route.ts` | Found |
| `app/api/product-events/route.ts` | Found |
| `app/api/webhooks/stripe/route.ts` | Found |
| `app/admin/page.tsx` | Found |
| `app/admin/*` | Found: overview, users, user detail, jobs, feedback, branch-ready, segments, nudges, lifecycle, email |
| `app/api/admin/*` | Found: admin email, feedback status/intelligence, nudge actions, and protected exports |

## Production Smoke Results

Production target: `https://cutswitch-site.vercel.app`

| Test | Result |
|---|---|
| `POST /api/app/session` with valid test credentials | `200`; access token and refresh token present, redacted in output |
| `POST /api/app/session/refresh` with invalid refresh token | `401` |
| `POST /api/app/session/refresh` with valid refresh token | `200`; new access token present, redacted in output |
| `POST /api/account/usage` with Bearer token | `200`; returned subscription, plan, usage, remaining seconds, and trial flag |
| `POST /api/transcripts/complete` new successful fingerprint | `200`; billed test duration |
| `POST /api/transcripts/complete` duplicate fingerprint | `200`; returned `reused: true`, `billableSeconds: 0` |
| `POST /api/transcripts/complete` failed status | `200`; returned `billableSeconds: 0` |
| `GET /admin` signed out | `307` redirect to `/login?next=%2Fadmin` |
| `POST /api/account/admin-status` with test account Bearer token | `200`; returned `{"isAdmin":true}` |
| `GET /api/admin/export/users.csv` signed out | `401` |
| `POST /api/feedback` missing token | `401` |
| `POST /api/feedback` invalid payload with valid token | `400` |
| `POST /api/feedback` valid token | `200`; returned `{ "ok": true }` after production schema/RLS repair |
| `POST /api/product-events` missing token | `401` |
| `POST /api/product-events` invalid payload with valid token | `400` |
| `POST /api/product-events` valid token | `200`; returned `{ "ok": true }` after production schema/RLS repair |

`npm run test:backend` against production also passed overall. It still reports `/api/events/export` as `500`, which was intentionally left unresolved in previous passes and is not blocking subscription/transcript usage.

## Production Feedback/Product Events Evidence

Vercel production runtime logs first showed the two admin-signal intake failures were schema drift:

```text
[feedback] insert failed {
  code: 'PGRST205',
  message: "Could not find the table 'public.feedback_events' in the schema cache"
}

[product-events] insert failed {
  code: 'PGRST205',
  message: "Could not find the table 'public.product_events' in the schema cache"
}
```

After the missing tables were created, `product_events` passed once an insert policy existed. `feedback_events` needed both insert and select policies because the route inserts and reads back `id` with `.select("id").single()`.

A local helper now exists to verify production schema once valid production Supabase env vars are available:

```bash
npx tsx scripts/checkSupabaseSchema.ts
```

The helper checks required `feedback_events`, `product_events`, and `admin_events` columns without printing secrets or user data.

An idempotent repair migration was added for production drift:

```text
supabase/migrations/20260430213000_feedback_product_events_schema_repair.sql
```

Use this if production migration history is unclear or if old migrations are recorded as applied but the tables are missing.

Close-loop smoke on 2026-05-01 confirmed the production schema/RLS repair is now active: valid feedback and product-event inserts both returned `200 { ok: true }`.

Privacy log check from that close-loop smoke found no raw feedback message, raw context marker, token test value, or fake private path in Vercel logs. Relevant logs contained only safe route labels and rate-limit availability warnings.

Final close-loop marker: `close-loop-green-1777699794395`

Row confirmation:

- `feedback_events`: confirmed by successful `200 { ok: true }` from the route, which inserts and reads back `id` with `.select("id").single()`.
- `product_events`: confirmed by successful `200 { ok: true }` from the route after production table/RLS repair.

## Stripe Webhook Hardening Evidence

Verified in `app/api/webhooks/stripe/route.ts`:

- Signature header is required via `req.headers.get("stripe-signature")`.
- Raw body is read with `await req.text()` before parsing.
- Signature is verified with `stripe.webhooks.constructEvent(rawBody, sig, getStripeWebhookSecret())`.
- Checkout completion uses a KV lock key: `stripe:checkout_session:<session_id>:lock`.
- Checkout completion stores a KV idempotency record: `stripe:checkout_session:<session_id>`.
- Subscription records are upserted by Stripe subscription data via `upsertSubscriptionRecord`.

Not found:

- No `stripe_webhook_events` SQL migration currently exists.

Live replay verification was not performed. To verify with Stripe CLI:

```bash
stripe listen --forward-to https://cutswitch-site.vercel.app/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

Then replay the same event from Stripe Dashboard or CLI and confirm the second delivery is a safe no-op and subscription state remains correct.

## Build And Test Evidence

- `npm run build`: passed on Next.js `14.2.35`.
- `npm run test:backend`: passed against production with tokens redacted in script output.
- `npm audit --audit-level=high`: still reports Next.js advisories that require a breaking upgrade to Next `16.2.4`; this remains unresolved by design for a separate upgrade pass.

## Resolved And Unresolved List

### [Resolved] Production feedback insert failed because table/RLS was missing

Production originally returned:

```json
{"error":"Unable to record feedback."}
```

Repo route exists and validates/authenticates correctly. Vercel production logs confirm:

```text
PGRST205: Could not find the table 'public.feedback_events' in the schema cache
```

Apply the idempotent repair migration to production Supabase:

- `supabase/migrations/20260430213000_feedback_product_events_schema_repair.sql`

If you are applying the original migration history instead, use these files in order:

- `supabase/migrations/20260428193000_admin_dashboard_phase_1a.sql`
- `supabase/migrations/20260428201000_feedback_intelligence_phase_2b.sql`
- `supabase/migrations/20260429203000_feedback_submission_fields.sql`

The final fix also required RLS insert/select policies because the route inserts and reads back `id` with `.select("id").single()`.

Final smoke: `POST /api/feedback` with a valid token returned `200 { "ok": true }`.

### [Resolved] Production product event insert failed because table/RLS was missing

Production originally returned:

```json
{"error":"Unable to record product event."}
```

Repo route exists and validates/authenticates correctly. Vercel production logs confirm:

```text
PGRST205: Could not find the table 'public.product_events' in the schema cache
```

Apply the idempotent repair migration to production Supabase:

- `supabase/migrations/20260430213000_feedback_product_events_schema_repair.sql`

If you are applying the original migration history instead, use:

- `supabase/migrations/20260428194500_product_events_phase_1b.sql`

The final fix also required an RLS insert policy.

Final smoke: `POST /api/product-events` with a valid token returned `200 { "ok": true }`.

### SQL to apply if Supabase migrations are not already tracked

Prefer applying the repair migration through Supabase CLI or the Supabase SQL Editor:

```text
supabase/migrations/20260430213000_feedback_product_events_schema_repair.sql
```

The repair migration creates `feedback_events`, `product_events`, and `admin_events` if missing, adds any missing columns used by current routes/admin pages, creates indexes, and enables RLS. Runtime API routes still do not create tables.

### [Unresolved] Production rate-limit store unavailable

During the close-loop smoke, production logs showed:

```text
[security:feedback_ip] rate limit unavailable { message: 'fetch failed' }
[security:product_events] rate limit unavailable { message: 'fetch failed' }
```

The app uses `@vercel/kv`, which requires:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

Production Vercel env contains those variable names, but the configured Upstash REST host does not resolve and `scripts/checkRateLimitStore.ts` returns `fetch failed`. Re-provision or reconnect Vercel KV/Upstash, update the production env values, redeploy, and re-run smoke.

Repo hardening now fails closed for `enforceRateLimit` in production when the store is unavailable, instead of silently relying on serverless in-memory behavior. `POST /api/account/usage` also has explicit rate-limit coverage in repo.

### [Unresolved] `/api/events/export`

Production backend smoke still reports `/api/events/export` as `500`. This was previously left unresolved and should remain separate unless it blocks app billing or transcript usage.

### [Unresolved] Next.js audit advisories

`npm audit --audit-level=high` still reports Next.js advisories whose automated fix requires a breaking upgrade to Next `16.2.4`. Current repo is on Next `14.2.35`.

### [Unresolved] Git status unavailable locally

`git status`, `git remote`, and `git log` via the Git CLI are blocked by the local Xcode license prompt. Repo facts above were read directly from `.git` files. To restore normal Git verification, run:

```bash
sudo xcodebuild -license
```

### [Unverified] Browser-cookie admin access

Signed-out `/admin` redirect and admin API auth were production-smoked. Full signed-in admin page access with Supabase SSR cookies was not verified because local `.env.local` lacks `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is needed to synthesize a Supabase cookie session outside the browser.

### [Unverified] Stripe replay/idempotency

Code evidence confirms signature verification and checkout-session KV idempotency, but no live Stripe CLI replay was run during this reconciliation.

### [Unverified] macOS app hardening

The website/backend auth endpoints are verified. macOS app Keychain storage, token refresh retry behavior, Release logging, and debug-control checks must be verified in the macOS app repo.
