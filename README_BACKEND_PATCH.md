# CutSwitch Backend Patch (Vercel / Next.js)

This patch adds minimal, practical protections and an `/api/entitlement` surface (plus license activation).

## What’s included
- Rate limiting by **IP + device_id** (KV-backed)
- Store `last_seen_at` and `app_version`
- Trial creation is idempotent (same `device_id` returns same `expires_at`)
- Optional **short-lived signed entitlement token** (HS256)
- New endpoints:
  - `GET /api/entitlement?device_id=...&app_version=...`
  - `POST /api/entitlement/activate` (Keygen-backed or allowlist keys)

## Environment variables
Required:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Optional (recommended):
- `ENTITLEMENT_SIGNING_KEY` (random long string for HS256 token signing)
- `LICENSE_MAX_DEVICES` (default: 2)

Keygen (recommended for production activation):
- `KEYGEN_ACCOUNT_ID`
- `KEYGEN_API_TOKEN` (optional; validate-key is public, but keep if you also use other Keygen endpoints)

If Keygen is **not** configured, activation falls back to an allowlist:
- `TEST_LICENSE_KEYS` (comma-separated list of keys that will be accepted)

## Notes
- These endpoints are intentionally minimal. No personal data, no fingerprinting beyond a per-install `device_id`.
- Client-side offline behavior remains: cached expiry rules exports.
