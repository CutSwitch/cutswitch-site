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

Returns the signed-in user's active subscription and transcript-hour usage.

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
    "id": "f746c96a-9309-42f6-a943-397f223ab860",
    "user_id": "ab008f84-3fbf-4775-96e1-ecb3d3f9b542",
    "plan_id": "studio",
    "stripe_customer_id": "cus_...",
    "stripe_subscription_id": "sub_...",
    "status": "active",
    "current_period_start": null,
    "current_period_end": null,
    "created_at": "2026-04-28T21:47:50.78268+00:00"
  },
  "plan": "studio",
  "totalUsedSeconds": 8,
  "remainingSeconds": 431992
}
```

### Response Fields

- `subscription`: the latest active subscription row, or `null` if the user has no active plan.
- `plan`: the active plan id, or `null`.
- `totalUsedSeconds`: sum of usage events where `event_type = "transcript_succeeded"`.
- `remainingSeconds`: plan monthly transcript seconds minus `totalUsedSeconds`, floored at `0`; `null` when there is no active plan.

### Plan IDs

```text
starter
creator_pro
studio
```

## POST /api/transcripts/complete

Records transcript completion after the app finishes a transcript/diarization attempt.

This endpoint is the billing ledger trigger for transcript hours. Call it only after the app knows whether a new transcript succeeded, failed, or was reused from cache.

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
- `durationSeconds`: transcript audio duration in seconds. The backend rounds up to the next whole second.
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

### Validation Error

```json
{
  "error": "Invalid transcript completion payload."
}
```

## Billing Rules

- A new successful transcript bills `durationSeconds`.
- A duplicate successful transcript for the same reuse key bills `0`.
- A failed transcript bills `0`.
- A cached/reused transcript bills `0`.
- Exporting does not bill transcript hours.
- Re-exporting does not bill transcript hours.
- Transcript hours are used only when CutSwitch creates a new successful transcript/diarization.

## macOS App Integration Notes

1. Sign in with the existing app session flow and store the returned Supabase `access_token` securely.
2. Before showing account/plan state, call `POST /api/account/usage` with the bearer token.
3. When a transcript job finishes, call `POST /api/transcripts/complete` exactly once with the final status.
4. Use stable privacy-safe fingerprints; never send local file paths, raw media names, or raw audio.
5. If the app reuses a cached transcript, send `status: "reused"` and the original fingerprints.
6. If transcription fails, send `status: "failed"`; the backend will record the failure without billing usage.
7. Do not call transcript completion for exports. Exports are not billable usage events.
8. Treat `billableSeconds` in the response as the source of truth for whether the operation consumed transcript hours.
9. If the endpoint returns `401`, refresh/re-authenticate the user before retrying.
10. If the endpoint returns `reused: true`, the app should not show the operation as newly billed.
