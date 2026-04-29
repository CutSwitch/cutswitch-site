# CutSwitch Backend API Contract

This contract is for the macOS app integration with the CutSwitch website backend.

Base URL:

```text
https://cutswitch-site.vercel.app
```

## Authentication

App-facing account endpoints require a Supabase access token.

Send the token on every protected request:

```http
Authorization: Bearer <access_token>
```

The backend derives the user from the token. Do not send or trust `userId` from the app client.

If the token is missing or invalid, protected endpoints return `401`.

```json
{
  "error": "Missing Authorization bearer token"
}
```

## POST /api/account/usage

Returns the signed-in user's active subscription and editing-time usage.

### Request

```http
POST /api/account/usage
Authorization: Bearer <access_token>
```

No JSON body is required.

### Success Response

```json
{
  "subscription": {
    "plan_id": "studio",
    "status": "active",
    "current_period_start": null,
    "current_period_end": null,
    "created_at": "2026-04-28T21:47:50.78268+00:00"
  },
  "plan": "studio",
  "totalUsedSeconds": 8,
  "remainingSeconds": 431992,
  "isTrial": false
}
```

### Response Fields

- `subscription`: the latest active or trialing subscription summary, or `null` if the user has no active plan. Internal Stripe ids are not exposed.
- `plan`: the active plan id, or `null`.
- `totalUsedSeconds`: sum of usage events where `event_type = "transcript_succeeded"`.
- `remainingSeconds`: plan monthly editing-time seconds minus `totalUsedSeconds`, floored at `0`; `null` when there is no active plan.
- `isTrial`: `true` when the current subscription is trialing.
- `trialIncludedSeconds`: `14400` when `isTrial` is true; omitted otherwise.

### Plan IDs

```text
starter
creator_pro
studio
```

## POST /api/transcripts/complete

Records transcript completion after the app finishes a transcript/diarization attempt.

This endpoint is the billing ledger trigger for editing time. Call it only after the app knows whether a new transcript succeeded, failed, or was reused from cache.

### Request

```http
POST /api/transcripts/complete
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "projectFingerprint": "project-fingerprint-v1",
  "audioFingerprint": "audio-fingerprint-v1",
  "durationSeconds": 3672,
  "speakerCount": 2,
  "providerJobId": "provider-job-123",
  "status": "succeeded"
}
```

### Request Fields

- `projectFingerprint`: stable, privacy-safe project identifier. Do not send raw file paths.
- `audioFingerprint`: stable, privacy-safe audio identifier. Do not send raw file paths.
- `durationSeconds`: source audio duration in seconds. The backend rounds up to the next whole second.
- `speakerCount`: number of speakers used for diarization/transcript identity.
- `providerJobId`: provider job id, or `null` if unavailable.
- `status`: one of `"succeeded"`, `"failed"`, or `"reused"`.

### Success: New Transcript Billed

```json
{
  "ok": true,
  "status": "succeeded",
  "billableSeconds": 3672,
  "reused": false
}
```

### Success: Duplicate Transcript Not Billed

If the same user already has a successful transcript for the same reuse key, the endpoint returns `reused: true` and bills `0` seconds.

Reuse key:

```text
user_id + projectFingerprint + audioFingerprint + speakerCount
```

```json
{
  "ok": true,
  "status": "reused",
  "billableSeconds": 0,
  "reused": true
}
```

### Success: Failed Transcript Not Billed

```json
{
  "ok": true,
  "status": "failed",
  "billableSeconds": 0,
  "reused": false
}
```

### Success: Explicit Reuse Not Billed

```json
{
  "ok": true,
  "status": "reused",
  "billableSeconds": 0,
  "reused": true
}
```

### Trial Editing Time Exhausted

When a trialing user would exceed the 4-hour trial allowance, the backend rejects the new successful transcript before recording billable usage.

```json
{
  "error": "Trial editing time exhausted"
}
```

### Validation Error

```json
{
  "error": "Invalid transcript completion payload."
}
```

## Billing Rules

- A trial includes 4 hours of editing time (`14400` seconds).
- A new successful transcript bills `durationSeconds`.
- A duplicate successful transcript for the same reuse key bills `0`.
- A failed transcript bills `0`.
- A cached/reused transcript bills `0`.
- Exporting does not bill editing time.
- Re-exporting does not bill editing time.
- Editing time is used only when CutSwitch creates a new successful transcript/diarization.

## macOS App Integration Notes

1. Sign in with the existing app session flow and store the returned Supabase `access_token` securely.
2. Before showing account/plan state, call `POST /api/account/usage` with the bearer token.
3. When a transcript job finishes, call `POST /api/transcripts/complete` exactly once with the final status.
4. Use stable privacy-safe fingerprints; never send local file paths, raw media names, or raw audio.
5. If the app reuses a cached transcript, send `status: "reused"` and the original fingerprints.
6. If transcript creation fails, send `status: "failed"`; the backend will record the failure without billing usage.
7. Do not call transcript completion for exports. Exports are not billable usage events.
8. Treat `billableSeconds` in the response as the source of truth for whether the operation consumed editing time.
9. If the endpoint returns `401`, refresh/re-authenticate the user before retrying.
10. If the endpoint returns `reused: true`, the app should not show the operation as newly billed.

## Production Trial Billing Verification (2026-04-28)

Verified against production with a fresh Supabase test user that had no prior Supabase subscription rows.

- Stripe Checkout displayed `7 days free`, then `$29.00 per month`, with `$0.00` due today.
- Checkout completed with a Stripe test card.
- Stripe subscription status was verified as `trialing`.
- Supabase `subscriptions.status` was verified as `trialing`.
- `POST /api/account/usage` returned `isTrial: true`, `trialIncludedSeconds: 14400`, `totalUsedSeconds: 0`, and `remainingSeconds: 14400`.
- The account dashboard showed `Trial active`, `4 hours of editing included`, `Used editing time`, and `Remaining editing time`.
- A safe mocked overage request for a new successful transcript with `durationSeconds: 14401` returned `Trial editing time exhausted` and did not record billable usage.
- `/api/events/export` remains unresolved by design and does not affect editing-time billing.

Note: local Stripe API verification was unavailable because the local Stripe key was expired. Stripe status was verified with a temporary production-only server-side inspection route, then the temporary route was removed.

## POST /api/feedback

Authenticated feedback intake for the macOS app or signed-in website surfaces.

### Request

```http
POST /api/feedback
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "type": "bug",
  "message": "The run failed after speaker matching.",
  "screen": "Run",
  "context": {
    "appVersion": "1.0.0",
    "errorCode": "safe_error_code"
  },
  "severity": "normal"
}
```

### Allowed Values

- `type`: `bug`, `idea`, `confusion`, `praise`, `pricing`, `onboarding`, `performance`, `export`, `account`
- `severity`: `low`, `normal`, `high`, `urgent`

### Success Response

```json
{
  "ok": true
}
```

### Privacy Rules

- The backend derives `user_id` from the bearer token.
- Do not send raw audio, transcripts, private file paths, or user tokens in `message` or `context`.
- The endpoint does not log the raw feedback message or context.

## Admin Phase 1A Routes

Admin routes require a cookie-backed Supabase session and an email listed in `ADMIN_EMAILS`.

Pages:

```text
/admin
/admin/users
/admin/feedback
```

Exports:

```text
/api/admin/export/users.csv
/api/admin/export/feedback.csv
/api/admin/export/feedback-branch-ready.md
/api/admin/export/feedback-ai.jsonl
```

Admin responses are private and use `Cache-Control: no-store`. Supabase service role access is server-side only.

## POST /api/product-events

Authenticated product signal intake for privacy-safe app events. These events power admin stuck/activation signals.

### Request

```http
POST /api/product-events
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "event_type": "project_imported",
  "screen": "Import",
  "app_version": "1.0.0",
  "project_fingerprint": "safe-project-hash",
  "source_duration_seconds": 3672,
  "metadata_json": {
    "speakerCount": 2
  }
}
```

### Allowed Event Types

```text
app_opened
signed_in
project_imported
speaker_count_confirmed
run_clicked
run_blocked_no_plan
run_blocked_insufficient_time
run_started
run_succeeded
run_failed
transcript_reused
export_created
feedback_opened
feedback_submitted
```

### Success Response

```json
{
  "ok": true
}
```

### Privacy Rules

- The backend derives `user_id` from the bearer token. Do not send `userId`.
- `project_fingerprint` must be a privacy-safe fingerprint, not a local file path or project title.
- Do not send raw audio, transcripts, FCPXML, local usernames, provider keys, tokens, or private file paths.
- `metadata_json` is capped and sanitized server-side; sensitive keys and path-like values are redacted.

### Example Events

```json
{
  "event_type": "run_failed",
  "screen": "Run",
  "app_version": "1.0.0",
  "project_fingerprint": "safe-project-hash",
  "source_duration_seconds": 3672,
  "metadata_json": {
    "errorCode": "analysis_timeout"
  }
}
```

```json
{
  "event_type": "transcript_reused",
  "screen": "Run",
  "project_fingerprint": "safe-project-hash"
}
```

## Admin Segments And Exports

Phase 2A adds server-derived founder/operator segments. These routes are admin-only and require the existing cookie SSR admin session plus `ADMIN_EMAILS` allowlist.

Pages:

```text
/admin/segments
/admin/segments/trial-never-ran
/admin/segments/imported-not-completed
/admin/segments/failed-twice
/admin/segments/near-quota
/admin/segments/heavy-users
/admin/segments/love-signals
/admin/segments/trial-exhausted
/admin/segments/ran-once-not-returned
/admin/segments/paid-user-near-limit
/admin/segments/branch-ready-feedback
/admin/segments/cancellation-risk
```

Protected exports:

```text
/api/admin/export/segments.csv
/api/admin/export/churn-risk.csv
/api/admin/export/heavy-users.csv
/api/admin/export/love-signals.csv
```

Segment scores are computed server-side for display/export only. They are not stored in the database. No emails are sent by these routes.

## Admin Feedback Intelligence

Phase 2B adds deterministic/manual triage fields for admin-only feedback workflows. These fields are stored on `feedback_events` and edited through protected admin APIs.

Optional feedback intelligence fields:

```text
title
summary
product_area
suggested_owner
suggested_branch_name
reproduction_likelihood
recommended_next_action
codex_ready
customer_impact
admin_priority
```

Allowed `product_area` values:

```text
onboarding
import
transcription_or_analysis
run
export
billing
account
website
performance
unclear
```

Allowed `admin_priority` values:

```text
low
normal
high
urgent
```

Allowed `reproduction_likelihood` values:

```text
unknown
low
medium
high
```

Protected admin endpoint:

```text
POST /api/admin/feedback/:id/intelligence
```

This endpoint requires admin cookie auth, updates feedback intelligence fields, and records an `admin_events` audit row. It does not call an LLM.

Protected exports updated in Phase 2B:

```text
/api/admin/export/feedback-branch-ready.md
/api/admin/export/feedback-ai.jsonl
```

Exports remain admin-only and must not include raw file paths, tokens, transcript text, audio content, or raw FCPXML.

## Admin Nudge Queue

Phase 2C adds a contextual nudge queue for admin review only. It does not send email.

Admin page:

```text
/admin/nudges
```

Protected admin endpoints:

```text
POST /api/admin/nudges/:id/status
GET /api/admin/export/nudges.csv
```

Allowed nudge statuses:

```text
draft
reviewed
suppressed
sent_placeholder
sent
```

`sent_placeholder` is reserved from Phase 2C. `sent` is used only after a reviewed one-off nudge is delivered through the Phase 3A Resend endpoint. Draft generation avoids duplicate drafts for the same `user_id + nudge_type + segment_key` within 7 days.

## Admin One-Off Nudge Sending

Phase 3A enables one-off sending for reviewed nudges only. Bulk broadcast and lifecycle campaigns remain disabled.

Required server env vars:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
ADMIN_EMAILS
```

Protected admin endpoint:

```text
POST /api/admin/nudges/:id/send
```

Rules:

- Requires admin cookie auth.
- Nudge status must be `reviewed`.
- Nudge must not already be sent or suppressed.
- Recipient must have an email address.
- `email_suppressions` is checked before sending.
- Suppressed recipients are not emailed and the nudge is marked `suppressed`.
- Successful sends mark `nudge_events.status = sent` and set `sent_at`.
- `admin_events` records the send action.

Compliance footer:

```text
You're receiving this because you use CutSwitch. Need help or want to opt out? Contact support: /support
```

[Unresolved] Dedicated unsubscribe/preference route is not implemented yet; support contact is the temporary opt-out path.

## Lifecycle Events

Phase 3B records safe lifecycle events and optionally forwards them to Loops. Resend transactional email remains separate.

Server env vars:

```text
LIFECYCLE_PROVIDER=none|loops|customerio
LOOPS_API_KEY
CUSTOMERIO_SITE_ID
CUSTOMERIO_API_KEY
```

Provider decision:

```text
Loops is the first implemented provider.
Customer.io remains [Unresolved] until explicitly selected.
```

Lifecycle event names:

```text
user_signed_up
trial_started
first_project_imported
first_run_started
first_run_succeeded
trial_never_ran_day_2
trial_exhausted
paid_subscription_started
near_quota
canceled_subscription
feedback_praise_received
repeated_failure
```

Recorded table:

```text
lifecycle_events
```

Admin page:

```text
GET /admin/lifecycle
```

Privacy rules:

- Send only email, user ID, plan/status, safe usage metrics, event name, and safe event properties.
- Do not send transcript content, raw project paths, raw FCPXML, tokens, provider secrets, private filenames, or audio content.
- Lifecycle failures do not block checkout, transcript completion, feedback, or product-event recording.

Current emit points:

- Stripe subscription webhook: `trial_started`, `paid_subscription_started`, `canceled_subscription`.
- Product events: `first_project_imported`, `first_run_started`.
- Transcript completion: `first_run_succeeded`, `trial_exhausted`, `near_quota`, `repeated_failure`.
- Feedback API: `feedback_praise_received`.

[Unresolved] `user_signed_up` and `trial_never_ran_day_2` require a future server-side signup hook or scheduled job.
[Unresolved] Customer.io provider API is not implemented in this phase.

## Admin Segmented Email Campaigns

Phase 3C adds admin-only segmented email campaigns. This is intentionally gated and suppression-aware.

Tables:

```text
email_campaigns
email_campaign_recipients
```

Admin pages:

```text
GET /admin/email
GET /admin/email/new
GET /admin/email/:id
```

Protected admin endpoints:

```text
GET  /api/admin/email/preview?segment_key=trial_never_ran
POST /api/admin/email
POST /api/admin/email/:id/review
POST /api/admin/email/:id/test
POST /api/admin/email/:id/send
```

Supported segment keys:

```text
trial_never_ran
imported_not_completed
failed_twice
near_quota
heavy_users
love_signals
canceled_users
```

Create campaign payload:

```json
{
  "name": "Trial first-run help",
  "subject": "Want help creating your first CutSwitch edit?",
  "body_markdown": "Short message with one clear next step.",
  "segment_key": "trial_never_ran"
}
```

Final send payload:

```json
{
  "confirmation": "SEND"
}
```

Rules:

- Admin auth required for all pages and endpoints.
- Preview is dry-run only and sends no email.
- Campaign must be `reviewed` before final send.
- Final send requires exact confirmation text: `SEND`.
- `email_suppressions` is checked before creation and again before final send.
- Invalid and suppressed recipients are skipped.
- Recipient status is tracked per email.
- `admin_events` records create, review, test send, and final send actions.
- Final sends are sequential and capped at the campaign recipient safety limit.

Compliance:

- Campaign emails are treated as marketing/update-style messages, not transactional account notices.
- Footer includes support/contact opt-out language.
- Do not send to suppressed users.
- Review consent assumptions before broad marketing use.

[Unresolved] Dedicated unsubscribe/preference links are not implemented yet; support contact is the temporary opt-out path.
