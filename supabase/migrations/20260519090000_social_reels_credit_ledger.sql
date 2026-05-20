-- Social Reels source-minute credit ledger and analysis job storage.
-- Additive schema only: service/server code owns all balance mutations.

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete cascade,
  account_type text not null default 'user' check (account_type in ('user', 'organization')),
  organization_id uuid,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  current_subscription_id text,
  plan_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (account_type = 'user' and owner_user_id is not null and organization_id is null)
    or
    (account_type = 'organization' and organization_id is not null)
  )
);

create table if not exists public.credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  source_analysis_job_id uuid,
  entry_type text not null check (entry_type in ('grant', 'reserve', 'capture', 'debit', 'refund', 'release', 'adjustment', 'overage')),
  credits integer not null check (credits > 0),
  balance_effect text not null check (balance_effect in ('increase_available', 'decrease_available', 'increase_reserved', 'decrease_reserved', 'none')),
  reservation_entry_id uuid references public.credit_ledger_entries(id),
  idempotency_key text not null,
  source text not null,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  subscription_period_start timestamptz,
  subscription_period_end timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (entry_type in ('capture', 'release') and reservation_entry_id is not null)
    or
    (entry_type not in ('capture', 'release'))
  )
);

create table if not exists public.source_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  status text not null default 'created' check (status in ('created', 'checking_credits', 'reserved', 'running', 'succeeded', 'failed', 'refunded', 'cached', 'cancelled')),
  idempotency_key text not null,
  source_fingerprint text not null,
  transcript_normalization_hash text not null,
  source_duration_seconds integer not null check (source_duration_seconds > 0),
  credits_required integer not null check (credits_required > 0),
  duration_buckets text[] not null default '{}'::text[] check (duration_buckets <@ array['15s', '30s', '60s', '90s', 'mixed']::text[]),
  reservation_ledger_entry_id uuid references public.credit_ledger_entries(id),
  capture_ledger_entry_id uuid references public.credit_ledger_entries(id),
  cache_entry_id uuid,
  analysis_mode text not null default 'social_reels',
  prompt_version text,
  schema_version text,
  provider text,
  model text,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  error_code text,
  error_message text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.source_analysis_job_candidates (
  id uuid primary key default gen_random_uuid(),
  source_analysis_job_id uuid not null references public.source_analysis_jobs(id) on delete cascade,
  candidate_id text not null,
  rank integer check (rank is null or rank > 0),
  duration_bucket text check (duration_bucket is null or duration_bucket in ('15s', '30s', '60s', '90s', 'mixed')),
  title text,
  summary text,
  source_start_word_id text,
  source_end_word_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_cache_entries (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  source_fingerprint text not null,
  transcript_normalization_hash text not null,
  analysis_mode text not null default 'social_reels',
  prompt_version text not null,
  schema_version text not null,
  duration_buckets text[] not null default '{}'::text[] check (duration_buckets <@ array['15s', '30s', '60s', '90s', 'mixed']::text[]),
  source_duration_seconds integer not null check (source_duration_seconds > 0),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  status text not null default 'ready' check (status in ('ready', 'stale', 'invalidated')),
  latest_source_analysis_job_id uuid references public.source_analysis_jobs(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'credit_ledger_entries_source_analysis_job_id_fkey'
  ) then
    alter table public.credit_ledger_entries
      add constraint credit_ledger_entries_source_analysis_job_id_fkey
      foreign key (source_analysis_job_id)
      references public.source_analysis_jobs(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'source_analysis_jobs_cache_entry_id_fkey'
  ) then
    alter table public.source_analysis_jobs
      add constraint source_analysis_jobs_cache_entry_id_fkey
      foreign key (cache_entry_id)
      references public.analysis_cache_entries(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists idx_credit_accounts_owner_user
  on public.credit_accounts(owner_user_id)
  where account_type = 'user';
create index if not exists idx_credit_accounts_owner_user_id on public.credit_accounts(owner_user_id);
create index if not exists idx_credit_accounts_org on public.credit_accounts(account_type, organization_id);
create index if not exists idx_credit_accounts_status_created on public.credit_accounts(status, created_at desc);

create unique index if not exists idx_credit_ledger_entries_account_idempotency
  on public.credit_ledger_entries(credit_account_id, idempotency_key);
create index if not exists idx_credit_ledger_entries_account_created
  on public.credit_ledger_entries(credit_account_id, created_at desc);
create index if not exists idx_credit_ledger_entries_job
  on public.credit_ledger_entries(source_analysis_job_id);
create index if not exists idx_credit_ledger_entries_type_created
  on public.credit_ledger_entries(entry_type, created_at desc);
create index if not exists idx_credit_ledger_entries_reservation
  on public.credit_ledger_entries(reservation_entry_id);
create index if not exists idx_credit_ledger_entries_user_created
  on public.credit_ledger_entries(user_id, created_at desc);

create unique index if not exists idx_source_analysis_jobs_account_idempotency
  on public.source_analysis_jobs(credit_account_id, idempotency_key);
create index if not exists idx_source_analysis_jobs_account_created
  on public.source_analysis_jobs(credit_account_id, created_at desc);
create index if not exists idx_source_analysis_jobs_user_created
  on public.source_analysis_jobs(user_id, created_at desc);
create index if not exists idx_source_analysis_jobs_status_created
  on public.source_analysis_jobs(status, created_at desc);
create index if not exists idx_source_analysis_jobs_source_hash
  on public.source_analysis_jobs(source_fingerprint, transcript_normalization_hash);
create index if not exists idx_source_analysis_jobs_cache_entry
  on public.source_analysis_jobs(cache_entry_id);

create unique index if not exists idx_source_analysis_job_candidates_job_candidate
  on public.source_analysis_job_candidates(source_analysis_job_id, candidate_id);
create index if not exists idx_source_analysis_job_candidates_job_rank
  on public.source_analysis_job_candidates(source_analysis_job_id, rank);
create index if not exists idx_source_analysis_job_candidates_duration
  on public.source_analysis_job_candidates(duration_bucket);

create unique index if not exists idx_analysis_cache_entries_cache_key
  on public.analysis_cache_entries(
    credit_account_id,
    source_fingerprint,
    transcript_normalization_hash,
    analysis_mode,
    prompt_version,
    schema_version,
    duration_buckets
  );
create index if not exists idx_analysis_cache_entries_account_last_used
  on public.analysis_cache_entries(credit_account_id, last_used_at desc);
create index if not exists idx_analysis_cache_entries_status_updated
  on public.analysis_cache_entries(status, updated_at desc);
create index if not exists idx_analysis_cache_entries_source_hash
  on public.analysis_cache_entries(source_fingerprint, transcript_normalization_hash);

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger_entries enable row level security;
alter table public.source_analysis_jobs enable row level security;
alter table public.source_analysis_job_candidates enable row level security;
alter table public.analysis_cache_entries enable row level security;

grant select on public.credit_accounts to authenticated;
grant select on public.credit_ledger_entries to authenticated;
grant select on public.source_analysis_jobs to authenticated;
grant select on public.source_analysis_job_candidates to authenticated;
grant select on public.analysis_cache_entries to authenticated;

grant select, insert, update, delete on public.credit_accounts to service_role;
grant select, insert, update, delete on public.credit_ledger_entries to service_role;
grant select, insert, update, delete on public.source_analysis_jobs to service_role;
grant select, insert, update, delete on public.source_analysis_job_candidates to service_role;
grant select, insert, update, delete on public.analysis_cache_entries to service_role;

drop policy if exists "authenticated users can read own credit accounts" on public.credit_accounts;
drop policy if exists "service role can manage credit accounts" on public.credit_accounts;
drop policy if exists "authenticated users can read own credit ledger" on public.credit_ledger_entries;
drop policy if exists "service role can manage credit ledger" on public.credit_ledger_entries;
drop policy if exists "authenticated users can read own source analysis jobs" on public.source_analysis_jobs;
drop policy if exists "service role can manage source analysis jobs" on public.source_analysis_jobs;
drop policy if exists "authenticated users can read own source analysis candidates" on public.source_analysis_job_candidates;
drop policy if exists "service role can manage source analysis candidates" on public.source_analysis_job_candidates;
drop policy if exists "authenticated users can read own analysis cache entries" on public.analysis_cache_entries;
drop policy if exists "service role can manage analysis cache entries" on public.analysis_cache_entries;

create policy "authenticated users can read own credit accounts"
on public.credit_accounts
as permissive
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "service role can manage credit accounts"
on public.credit_accounts
as permissive
for all
to service_role
using (true)
with check (true);

create policy "authenticated users can read own credit ledger"
on public.credit_ledger_entries
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.credit_accounts account
    where account.id = credit_ledger_entries.credit_account_id
      and account.owner_user_id = auth.uid()
  )
);

create policy "service role can manage credit ledger"
on public.credit_ledger_entries
as permissive
for all
to service_role
using (true)
with check (true);

create policy "authenticated users can read own source analysis jobs"
on public.source_analysis_jobs
as permissive
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.credit_accounts account
    where account.id = source_analysis_jobs.credit_account_id
      and account.owner_user_id = auth.uid()
  )
);

create policy "service role can manage source analysis jobs"
on public.source_analysis_jobs
as permissive
for all
to service_role
using (true)
with check (true);

create policy "authenticated users can read own source analysis candidates"
on public.source_analysis_job_candidates
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.source_analysis_jobs job
    join public.credit_accounts account on account.id = job.credit_account_id
    where job.id = source_analysis_job_candidates.source_analysis_job_id
      and (job.user_id = auth.uid() or account.owner_user_id = auth.uid())
  )
);

create policy "service role can manage source analysis candidates"
on public.source_analysis_job_candidates
as permissive
for all
to service_role
using (true)
with check (true);

create policy "authenticated users can read own analysis cache entries"
on public.analysis_cache_entries
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.credit_accounts account
    where account.id = analysis_cache_entries.credit_account_id
      and account.owner_user_id = auth.uid()
  )
);

create policy "service role can manage analysis cache entries"
on public.analysis_cache_entries
as permissive
for all
to service_role
using (true)
with check (true);

select pg_notify('pgrst', 'reload schema');
