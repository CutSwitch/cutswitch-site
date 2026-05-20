# Social Reels Credit Deployment Checklist

## Scope

This checklist gates rollout for the credit-based Social Reels discovery backend. It covers deployment safety only; it does not change product behavior, app compatibility, pricing, migrations, or production flags.

Production status:

- Development integration is ready.
- Production enablement is still gated on staging/dev mutation validation for Supabase RPCs, RLS writes, and concurrent reservation behavior.
- Do not enable production credit-aware discovery until every production gate below is complete.

## Required Environment Variables

Set values through the deployment platform secret/env manager. Do not print or paste secret values into logs, docs, test output, support tickets, or PR comments.

### Supabase

Required for backend auth, service-role writes, ledger/RPC access, and app sessions:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Deployment validation variables used by CLI/operator machines only:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

### Stripe And Plan Credits

Required for subscription/webhook behavior and included monthly Social Reels credit grants:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_CREATOR_PRO`
- `STRIPE_PRICE_STUDIO`

Rules:

- Use Stripe test-mode keys and price ids in staging.
- Use Stripe live-mode keys and live price ids only in production.
- Do not change live product/price ids as part of Social Reels rollout unless a separate billing migration is approved.

### OpenAI Social Reels Discovery

Required only for live provider mode:

- `OPENAI_API_KEY`
- `SOCIAL_REELS_OPENAI_MODE`
- `SOCIAL_REELS_OPENAI_MODEL`
- `SOCIAL_REELS_OPENAI_REASONING_EFFORT`
- `SOCIAL_REELS_OPENAI_MAX_OUTPUT_TOKENS`
- `SOCIAL_REELS_OPENAI_SERVICE_TIER`
- `SOCIAL_REELS_OPENAI_TIMEOUT_MS`
- `SOCIAL_REELS_LIVE_CANDIDATE_COUNT`
- `SOCIAL_REELS_LIVE_WINDOW_COUNT`
- `SOCIAL_REELS_OPENAI_PROBE_TIMEOUT_MS`

Safe defaults:

- Missing `SOCIAL_REELS_OPENAI_MODE` defaults to `mock`.
- `SOCIAL_REELS_OPENAI_MODE=mock` must not call OpenAI, even if `OPENAI_API_KEY` exists.
- `SOCIAL_REELS_OPENAI_MODE=live` requires `OPENAI_API_KEY`.

### Feature Flags

Credit-aware discovery must remain off until migrations, RPC validation, app compatibility, Stripe grants, and staging smoke checks pass:

- `ENABLE_SOCIAL_REELS_DISCOVER_CREDITS=true`

Flag behavior:

- Disabled: legacy `/api/social-reels/discover` behavior remains intact and no credit reservation/capture path should execute.
- Enabled: backend checks/creates credit account, checks cache, reserves credits, runs discovery, captures on success, releases on failure, and returns top-level `billing`.

### Public URLs And App Support

Required for callback/portal/link behavior and app/backend routing:

- `NEXT_PUBLIC_SITE_URL`
- `VERCEL_URL` as deployment fallback
- `NEXT_PUBLIC_DOWNLOAD_URL_MAC` if download links are used in transactional flows

Existing entitlement/licensing integrations may also require:

- `KEYGEN_ACCOUNT_ID`
- `KEYGEN_POLICY_ID`
- `KEYGEN_POLICY_ID_MONTHLY`
- `KEYGEN_POLICY_ID_YEARLY`
- `KEYGEN_POLICY_ID_LIFETIME`
- `KEYGEN_API_TOKEN` or `KEYGEN_API_KEY`
- `REWARDFUL_WEBHOOK_TOKEN`
- `NEXT_PUBLIC_REWARDFUL_API_KEY`

## Migration Ordering

Apply migrations before enabling any feature flag or live app flow.

1. Apply `supabase/migrations/20260519090000_social_reels_credit_ledger.sql`.
2. Apply `supabase/migrations/20260519093000_social_reels_credit_atomic_rpcs.sql`.
3. Confirm tables exist:
   - `credit_accounts`
   - `credit_ledger_entries`
   - `source_analysis_jobs`
   - `source_analysis_job_candidates`
   - `analysis_cache_entries`
4. Confirm RPCs exist:
   - `public.social_reels_credit_reserve_v1`
   - `public.social_reels_credit_capture_v1`
   - `public.social_reels_credit_release_v1`
   - `public.social_reels_credit_refund_v1`
5. Confirm RLS remains enabled and authenticated users can select only their own rows.
6. Confirm service-role/server path can write.
7. Confirm authenticated users cannot directly mutate credit balances or ledger entries.

Recommended validation commands:

```bash
supabase migration list
supabase db push --dry-run
npm run test:social-reels-credit-ledger
npm run test:social-reels-credit-flow
npm run test:social-reels-discover-credits
npm run build
```

Do not run destructive `db reset` commands against staging or production-like projects.

## Feature-Flag Rollout Order

1. Keep `ENABLE_SOCIAL_REELS_DISCOVER_CREDITS` disabled everywhere.
2. Apply migrations in staging.
3. Validate RPC definitions and database metadata in staging.
4. Run staging mutation validation with non-production accounts:
   - create/get credit account
   - grant test credits
   - reserve
   - capture
   - release
   - refund when capture already happened
   - retry same idempotency key with same payload
   - retry same idempotency key with different payload
   - approximate concurrent reservations and confirm no overspend
5. Configure staging env vars.
6. Enable `ENABLE_SOCIAL_REELS_DISCOVER_CREDITS=true` in staging only.
7. Run backend smoke tests.
8. Run app/backend fixture compatibility smoke.
9. Verify Stripe test-mode monthly/trial grants write one ledger grant per idempotency period.
10. Verify no-charge cache hits:
    - first request charges full source-minute credits
    - second matching request returns `billing.cacheStatus = "hit"`
    - second matching request returns `creditsCharged = 0`
11. Verify failed/released behavior:
    - provider/schema failure after reservation creates a `release`
    - no `capture` exists for the failed job
    - app receives an error envelope with `response_schema = "social_reels_error_v1"` and `reason_code` or `code`
12. Review logs for secret/raw payload leakage.
13. Repeat validation in production with feature flag still disabled.
14. Only after explicit approval, enable production feature flag.

## Staging Versus Production Validation

### Staging Required

Staging must use non-production accounts and Stripe test-mode. It is the only place to run mutation and concurrency validation before production.

Required staging checks:

- RPC runtime writes succeed through service-role path.
- Authenticated direct mutation attempts fail.
- Available balance cannot be overspent by concurrent reservations.
- Idempotency key conflict returns `idempotency_key_conflict`.
- Failed provider/schema work releases reserved credits.
- Captured failed jobs can be refunded through append-only ledger entries when that path is exercised.
- Cache entries do not cross account boundaries.
- Cache-hit regeneration does not reserve or capture credits.

### Production Required Before Flag Enablement

Production checks must be read-only or narrowly controlled while the feature flag is disabled:

- Migration history matches staging.
- Tables and RPCs exist.
- RLS and grants match staging.
- Stripe live price env vars match intended plans.
- Webhook secret is configured.
- OpenAI live env vars are configured if live discovery will be enabled.
- Backend build is deployed.
- App version that understands canonical fixtures is available to users.

Do not run unsafe mutation stress tests against production-like projects.

## Stripe Webhook Ordering

Stripe grant behavior must be ready before production users can spend Social Reels credits.

Ordering:

1. Deploy migration/RPC schema.
2. Deploy ledger service and Stripe mapping code.
3. Configure Stripe env vars.
4. Validate test-mode grants in staging.
5. Confirm webhook replay does not duplicate grants.
6. Confirm unknown price ids fail safely without ledger grants.
7. Confirm grant metadata contains only sanitized references.
8. Enable Social Reels credits/discovery feature flag after grants are verified.

Do not directly mutate balances. Grant credits through ledger entries only.

## Cache Behavior To Validate

Cache key includes:

- credit account
- source media fingerprint
- source duration seconds
- transcript normalization hash
- optional word hash when supplied
- canonicalized duration buckets
- analysis mode
- prompt version
- response schema version

Required cache checks:

- Same source, transcript, duration buckets, prompt version, and schema version returns `hit`.
- Reordered duration buckets canonicalize to the same cache key.
- Changed transcript hash returns `miss`.
- Changed source fingerprint returns `miss`.
- Changed prompt/schema version returns `miss`.
- Stale/corrupt cache regenerates safely and reports `stale`.
- Cache hit returns no full source-minute charge.
- Cache does not leak across users or credit accounts.

## App/Backend Fixture Compatibility

Canonical backend fixtures:

- `docs/contracts/social_reels_discover_credit_flow_success.backend_fixture.json`
- `docs/contracts/social_reels_discover_credit_flow_cached.backend_fixture.json`
- `docs/contracts/social_reels_discover_credit_flow_insufficient_credits.backend_fixture.json`
- `docs/contracts/social_reels_discover_credit_flow_failed_released.backend_fixture.json`

Compatibility rules:

- Keep top-level `billing`.
- Keep top-level `groups`.
- Keep top-level `candidates` where the route returns candidate responses.
- Keep `groups` as an array shaped like `[{ durationBucket, candidates }]`.
- Keep snake_case candidate fields, including `candidate_id`, `duration_bucket`, `source_start_word_id`, `source_end_word_id`, `transcript_excerpt`, and `suggested_caption`.
- Keep camelCase billing fields, including `sourceDurationSeconds`, `creditsRequired`, `creditsRequiredForFullRun`, `creditsReserved`, `creditsCharged`, `creditsRefunded`, `cacheStatus`, `noFullSourceMinuteCharge`, and `regenerationPolicy`.
- Keep `response_schema`.
- Successful credit-aware candidate responses use `social_reels_candidates_v1`.
- Cached success responses use `cached_candidates`.
- Error responses use `social_reels_error_v1` and include `reason_code` and/or `code`.

Run before rollout:

```bash
npm run test:social-reels-credit-flow
npm run test:social-reels-discover-credits
```

## Monitoring And Alerting Targets

Track only safe ids, counts, durations, statuses, and reason codes. Do not log raw transcripts, raw word JSON, provider payloads, local file paths, media paths, cache paths, tokens, Authorization headers, service-role keys, OpenAI keys, Whisper payloads, or pyannote payloads.

### Billing And Ledger

Monitor:

- `credit_ledger_entries.entry_type = 'grant'` volume by source and plan.
- `reserve` count versus `capture` count.
- `release` count and rate.
- `refund` count and rate.
- available/reserved/consumed ledger-derived balance consistency.
- ledger rows with `idempotency_key` conflicts.
- failed RPC exceptions by reason code.

Alert candidates:

- capture count drops to zero while reserve count remains nonzero.
- release/refund rate spikes above normal provider failure baseline.
- `idempotency_key_conflict` appears repeatedly for one account or route client version.
- negative available balance appears in derived balance checks.
- grant rows stop appearing after Stripe renewal events.

### Discovery And Provider

Monitor:

- `source_analysis_jobs.status`.
- `job_failed_openai`, `job_failed_schema`, and `job_failed_timeout`.
- provider schema mismatch count.
- OpenAI timeout count.
- `returned_candidate_count` and empty/no-valid-candidate failures.
- live versus mock mode in diagnostics.

Alert candidates:

- `job_failed_schema` increases after prompt/schema changes.
- timeout rate increases after model, service tier, or token limit changes.
- successful jobs return unusually low candidate counts.

### Cache

Monitor:

- `analysis_cache_entries.status`.
- `billing.cacheStatus` distribution: `hit`, `miss`, `stale`, `disabled`, `idempotent_replay`.
- cache hit rate by prompt/schema version.
- stale/corrupt cache recovery count.
- no-charge cache-hit count.

Alert candidates:

- cache hit rate unexpectedly drops after deployment.
- stale cache rate spikes.
- cache hits are followed by reserve/capture entries for the same request key.

### App/Error States

Monitor safe error reason codes:

- `auth_required`
- `insufficient_credits`
- `cloud_unavailable_after_auth`
- `schema_mismatch`
- `job_failed_openai`
- `job_failed_schema`
- `job_failed_timeout`
- `cache_unavailable` if added later

Alert candidates:

- `insufficient_credits` spikes after Stripe renewal window.
- `auth_required` spikes after app release.
- `cloud_unavailable_after_auth` appears while backend health is otherwise normal.

## Production Gates Before Enabling Credits/Discovery

Do not enable `ENABLE_SOCIAL_REELS_DISCOVER_CREDITS` in production until:

- Migrations are applied.
- RPCs exist and were runtime-validated in staging.
- Staging mutation/concurrency/RLS validation passed.
- Stripe test-mode grants passed in staging.
- Production Stripe env vars are configured and reviewed.
- OpenAI live env vars are configured and reviewed if live mode is intended.
- App/backend canonical fixture smoke passed.
- Backend tests and build passed.
- Cache hit no-charge behavior passed.
- Failed/released behavior passed.
- Monitoring dashboard/queries are ready.
- Rollback owner and decision path are named.
- Production feature flag enablement is approved.

## Rollback Strategy

Primary rollback:

1. Disable `ENABLE_SOCIAL_REELS_DISCOVER_CREDITS`.
2. Confirm legacy `/api/social-reels/discover` behavior is active.
3. Stop or pause any rollout that depends on credit-aware discovery.
4. Keep migrations and RPCs in place unless a separate database rollback is explicitly approved.

Ledger rules:

- Preserve ledger history.
- Do not delete ledger rows.
- Do not mutate historical entries to "fix" balances.
- Use append-only `adjustment` entries for manual corrections.
- Use `refund` entries when captured credits must be returned.
- Use `release` entries when reserved credits were not captured.

Cache rules:

- Preserve cache entries unless corruption is confirmed.
- Prefer marking cache entries `stale` or `invalidated` over deletion.
- Do not delete cache as a billing rollback mechanism.

Endpoint compatibility rollback:

- Preserve app compatibility fields while disabling the feature flag.
- If route compatibility must be reverted, first confirm the active app version no longer depends on `billing`, `groups`, `response_schema`, mixed casing, or error reason codes.

Stripe rollback:

- Do not delete grant ledger entries.
- If a duplicate grant happened, write an append-only `adjustment` entry after review.
- Keep webhook idempotency keys intact so replay behavior remains safe.

## Standard Verification Commands

Run before staging flag enablement and before production approval:

```bash
git diff --check
npm run test:social-reels-credit-flow
npm run test:social-reels-discover-credits
npm run test:social-reels-credit-ledger
npm run test:social-reels-stripe-credits
npm run test:social-reels-prompt
npm run test:social-reels-golden
npm run test:backend
npm run build
```

Live OpenAI checks are optional, gated, and must use synthetic safe text only. They are not part of the default deployment checklist and must not run in normal tests.
