# Social Reels Credit Schema Plan

## Scope

This is a schema planning document only. Do not run this as SQL. The migration slice should convert this model into idempotent Supabase migrations after review.

The repo currently uses Supabase tables such as `subscriptions`, `usage_events`, `transcript_jobs`, and app/admin event tables. Existing migrations use `create table if not exists`, `create index if not exists`, check constraints, `jsonb` metadata, `timestamptz default now()`, and RLS enablement. The proposed Social Reels credit tables should follow that style.

## Naming

Recommended table names:

- `credit_accounts`
- `credit_ledger_entries`
- `source_analysis_jobs`
- `source_analysis_job_candidates`
- `analysis_cache_entries`

If the migration slice finds equivalent production tables, adapt to those names rather than creating duplicates.

## `credit_accounts`

Purpose: account boundary for balances. Start with personal accounts, leave room for teams/orgs.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `owner_user_id uuid references public.users(id) on delete cascade`
- `account_type text not null default 'user' check (account_type in ('user', 'organization'))`
- `organization_id uuid null`
- `status text not null default 'active' check (status in ('active', 'suspended', 'closed'))`
- `current_subscription_id text null`
- `plan_id text null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended constraints/indexes:

- Unique personal account per `owner_user_id` where `account_type = 'user'`
- Index `owner_user_id`
- Index `(account_type, organization_id)`
- Index `(status, created_at desc)`

## `credit_ledger_entries`

Purpose: append-only audit trail for credits.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `credit_account_id uuid not null references public.credit_accounts(id) on delete cascade`
- `user_id uuid references public.users(id) on delete set null`
- `source_analysis_job_id uuid null`
- `entry_type text not null check (entry_type in ('grant', 'reserve', 'capture', 'debit', 'refund', 'release', 'adjustment', 'overage'))`
- `credits integer not null check (credits > 0)`
- `balance_effect text not null check (balance_effect in ('increase_available', 'decrease_available', 'increase_reserved', 'decrease_reserved', 'none'))`
- `reservation_entry_id uuid null references public.credit_ledger_entries(id)`
- `idempotency_key text not null`
- `source text not null`
- `stripe_invoice_id text null`
- `stripe_payment_intent_id text null`
- `subscription_period_start timestamptz null`
- `subscription_period_end timestamptz null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Recommended constraints/indexes:

- Unique `(credit_account_id, idempotency_key)`
- Index `(credit_account_id, created_at desc)`
- Index `(source_analysis_job_id)`
- Index `(entry_type, created_at desc)`
- Optional check requiring `reservation_entry_id` for `capture` and `release`

Notes:

- Store positive `credits`; use `entry_type` / `balance_effect` to derive direction.
- Do not update entries except rare admin correction metadata. Use compensating entries for auditability.

## `source_analysis_jobs`

Purpose: one source media Social Reels analysis run.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `credit_account_id uuid not null references public.credit_accounts(id) on delete cascade`
- `user_id uuid references public.users(id) on delete set null`
- `status text not null check (status in ('created', 'checking_credits', 'reserved', 'running', 'succeeded', 'failed', 'refunded', 'cached', 'cancelled'))`
- `idempotency_key text not null`
- `source_fingerprint text not null`
- `transcript_normalization_hash text not null`
- `source_duration_seconds integer not null check (source_duration_seconds > 0)`
- `credits_required integer not null check (credits_required > 0)`
- `reservation_ledger_entry_id uuid null references public.credit_ledger_entries(id)`
- `capture_ledger_entry_id uuid null references public.credit_ledger_entries(id)`
- `cache_entry_id uuid null`
- `analysis_mode text not null default 'social_reels'`
- `prompt_version text null`
- `schema_version text null`
- `provider text null`
- `model text null`
- `candidate_count integer not null default 0 check (candidate_count >= 0)`
- `error_code text null`
- `error_message text null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `updated_at timestamptz not null default now()`

Recommended constraints/indexes:

- Unique `(credit_account_id, idempotency_key)`
- Index `(credit_account_id, created_at desc)`
- Index `(user_id, created_at desc)`
- Index `(source_fingerprint, transcript_normalization_hash)`
- Index `(status, created_at desc)`
- Index `(cache_entry_id)`

Privacy:

- `source_fingerprint` must be privacy-safe.
- Do not store raw transcript text, raw word JSON, local media paths, cache paths, or provider payloads.

## `source_analysis_job_candidates`

Purpose: candidate rows returned from one charged source analysis job.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `source_analysis_job_id uuid not null references public.source_analysis_jobs(id) on delete cascade`
- `candidate_id text not null`
- `rank integer null`
- `duration_bucket text null`
- `title text null`
- `summary text null`
- `source_start_word_id text null`
- `source_end_word_id text null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Recommended constraints/indexes:

- Unique `(source_analysis_job_id, candidate_id)`
- Index `(source_analysis_job_id, rank)`
- Index `(duration_bucket)`

Billing rule:

- Candidate rows never create extra charges.
- Candidate count is not part of `credits_required`.

Privacy:

- Keep candidate metadata safe and compact.
- Avoid raw transcript excerpts unless a future privacy review explicitly approves them.

## `analysis_cache_entries`

Purpose: cache identity for source analysis reuse and no-charge regeneration.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `credit_account_id uuid not null references public.credit_accounts(id) on delete cascade`
- `source_fingerprint text not null`
- `transcript_normalization_hash text not null`
- `analysis_mode text not null default 'social_reels'`
- `prompt_version text not null`
- `schema_version text not null`
- `source_duration_seconds integer not null check (source_duration_seconds > 0)`
- `candidate_count integer not null default 0 check (candidate_count >= 0)`
- `status text not null default 'ready' check (status in ('ready', 'stale', 'invalidated'))`
- `latest_source_analysis_job_id uuid null`
- `metadata_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `last_used_at timestamptz null`

Recommended constraints/indexes:

- Unique `(credit_account_id, source_fingerprint, transcript_normalization_hash, analysis_mode, prompt_version, schema_version)`
- Index `(credit_account_id, last_used_at desc)`
- Index `(status, updated_at desc)`

Cache behavior:

- A valid `ready` cache entry can produce a zero-capture `cached` job.
- Cache invalidation should create new entries rather than mutating prior job economics.

## Credit Calculation

Application helper:

```text
if sourceDurationSeconds <= 0: invalid request
creditsRequired = max(1, ceil(sourceDurationSeconds / 60))
```

Use integer credits only.

Do not compute credits from:

- Candidate count
- Duration bucket count
- Caption style
- Aspect ratio
- Number of generated titles

## Idempotency

Required idempotency keys:

- Job creation: user/account + request id or app-supplied idempotency key
- Reserve: job id + `reserve`
- Capture: job id + `capture`
- Release: job id + `release`
- Refund: job id + `refund`
- Grant: subscription id + billing period + plan id

Retries with the same key must return the existing result.

## Reserve/Capture Flow

1. Insert or fetch `source_analysis_jobs` by idempotency key.
2. If matching succeeded/cached job exists, return existing candidates.
3. Ensure or create `credit_accounts` for the user/account.
4. Check available credits from ledger-derived balance.
5. Insert `reserve` ledger entry.
6. Update job to `reserved`, then `running`.
7. Run provider work.
8. If successful candidates exist, insert `capture` ledger entry and update job to `succeeded`.
9. If provider fails or no valid candidates exist, insert `release` ledger entry and update job to `failed` or `cancelled`.

## Direct Debit Alternative

Direct debit can be implemented as:

- Check balance.
- Insert `debit` before provider work.
- Insert `refund` on failure.

Reserve/capture remains the default recommendation because it models in-flight work more clearly and avoids showing a completed debit while provider work is still running.

## RLS / Access

Follow existing app pattern:

- App-facing mutations should be handled by authenticated API routes using service role.
- Service role can insert/update/select operational tables.
- Authenticated users may read only their own public account/job summaries if direct table reads are ever exposed.
- Admin dashboards can use server-side service role reads.

Do not expose raw ledger metadata that could contain provider internals or support notes to clients.

## Migration Notes For Later Slice

- Use `create table if not exists`.
- Use `create index if not exists`.
- Enable RLS on new tables.
- Add service-role grants/policies consistent with existing migrations.
- Keep check constraints explicit.
- Avoid triggers unless the repo already adopts them for updated timestamps.
- Add a PostgREST schema reload notification if needed.

## Open Product Questions

- Is the Social Reels credit balance displayed separately from editing-time usage?
- Do monthly included credits roll over?
- Do purchased credits expire?
- Should team/org accounts pool credits across members?
- Does a cache hit after prompt-version change remain free?
- Should no-valid-candidate results always release credits?
- What account/ledger data should be visible in `/api/account/usage`?

## Rollback

Rollback by removing this schema planning document and the companion credit model document. No database migration is introduced here.
