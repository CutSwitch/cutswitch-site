-- Atomic Social Reels credit ledger mutations.
-- These RPCs serialize mutations per credit account with row-level locks.

create or replace function public.social_reels_credit_reserve_v1(
  p_credit_account_id uuid,
  p_credits integer,
  p_idempotency_key text,
  p_payload_hash text,
  p_user_id uuid default null,
  p_source_analysis_job_id uuid default null,
  p_source text default 'social_reels_source_analysis',
  p_metadata_json jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  credit_account_id uuid,
  user_id uuid,
  source_analysis_job_id uuid,
  entry_type text,
  credits integer,
  balance_effect text,
  reservation_entry_id uuid,
  idempotency_key text,
  source text,
  metadata_json jsonb,
  created_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_ledger_entries%rowtype;
  v_entry public.credit_ledger_entries%rowtype;
  v_available integer;
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'credit_reservation_failed';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 or p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception 'credit_reservation_failed';
  end if;

  perform 1
  from public.credit_accounts account
  where account.id = p_credit_account_id
  for update;

  if not found then
    raise exception 'credit_account_missing';
  end if;

  select *
  into v_existing
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if coalesce(v_existing.metadata_json->>'payload_hash', '') <> p_payload_hash then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
    select
      v_existing.id,
      v_existing.credit_account_id,
      v_existing.user_id,
      v_existing.source_analysis_job_id,
      v_existing.entry_type,
      v_existing.credits,
      v_existing.balance_effect,
      v_existing.reservation_entry_id,
      v_existing.idempotency_key,
      v_existing.source,
      v_existing.metadata_json,
      v_existing.created_at,
      true;
    return;
  end if;

  select coalesce(sum(
    case entry.balance_effect
      when 'increase_available' then entry.credits
      when 'decrease_available' then -entry.credits
      else 0
    end
  ), 0)
  into v_available
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id;

  if v_available < p_credits then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger_entries (
    credit_account_id,
    user_id,
    source_analysis_job_id,
    entry_type,
    credits,
    balance_effect,
    reservation_entry_id,
    idempotency_key,
    source,
    metadata_json
  )
  values (
    p_credit_account_id,
    p_user_id,
    p_source_analysis_job_id,
    'reserve',
    p_credits,
    'decrease_available',
    null,
    p_idempotency_key,
    coalesce(nullif(trim(p_source), ''), 'social_reels_source_analysis'),
    coalesce(p_metadata_json, '{}'::jsonb) || jsonb_build_object('payload_hash', p_payload_hash)
  )
  returning * into v_entry;

  return query
  select
    v_entry.id,
    v_entry.credit_account_id,
    v_entry.user_id,
    v_entry.source_analysis_job_id,
    v_entry.entry_type,
    v_entry.credits,
    v_entry.balance_effect,
    v_entry.reservation_entry_id,
    v_entry.idempotency_key,
    v_entry.source,
    v_entry.metadata_json,
    v_entry.created_at,
    false;
end;
$$;

create or replace function public.social_reels_credit_capture_v1(
  p_credit_account_id uuid,
  p_reservation_entry_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_credits integer default null,
  p_metadata_json jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  credit_account_id uuid,
  user_id uuid,
  source_analysis_job_id uuid,
  entry_type text,
  credits integer,
  balance_effect text,
  reservation_entry_id uuid,
  idempotency_key text,
  source text,
  metadata_json jsonb,
  created_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_ledger_entries%rowtype;
  v_reservation public.credit_ledger_entries%rowtype;
  v_terminal public.credit_ledger_entries%rowtype;
  v_entry public.credit_ledger_entries%rowtype;
  v_credits integer;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 or p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception 'credit_capture_failed';
  end if;

  perform 1
  from public.credit_accounts account
  where account.id = p_credit_account_id
  for update;

  if not found then
    raise exception 'credit_account_missing';
  end if;

  select *
  into v_existing
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if coalesce(v_existing.metadata_json->>'payload_hash', '') <> p_payload_hash then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
    select
      v_existing.id,
      v_existing.credit_account_id,
      v_existing.user_id,
      v_existing.source_analysis_job_id,
      v_existing.entry_type,
      v_existing.credits,
      v_existing.balance_effect,
      v_existing.reservation_entry_id,
      v_existing.idempotency_key,
      v_existing.source,
      v_existing.metadata_json,
      v_existing.created_at,
      true;
    return;
  end if;

  select *
  into v_reservation
  from public.credit_ledger_entries entry
  where entry.id = p_reservation_entry_id
    and entry.credit_account_id = p_credit_account_id
    and entry.entry_type = 'reserve'
  limit 1;

  if not found then
    raise exception 'credit_capture_failed';
  end if;

  select *
  into v_terminal
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.reservation_entry_id = p_reservation_entry_id
    and entry.entry_type = 'capture'
  order by entry.created_at asc
  limit 1;

  if found then
    return query
    select
      v_terminal.id,
      v_terminal.credit_account_id,
      v_terminal.user_id,
      v_terminal.source_analysis_job_id,
      v_terminal.entry_type,
      v_terminal.credits,
      v_terminal.balance_effect,
      v_terminal.reservation_entry_id,
      v_terminal.idempotency_key,
      v_terminal.source,
      v_terminal.metadata_json,
      v_terminal.created_at,
      true;
    return;
  end if;

  select *
  into v_terminal
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.reservation_entry_id = p_reservation_entry_id
    and entry.entry_type = 'release'
  limit 1;

  if found then
    raise exception 'credit_capture_failed';
  end if;

  v_credits := coalesce(p_credits, v_reservation.credits);
  if v_credits <= 0 or v_credits > v_reservation.credits then
    raise exception 'credit_capture_failed';
  end if;

  insert into public.credit_ledger_entries (
    credit_account_id,
    user_id,
    source_analysis_job_id,
    entry_type,
    credits,
    balance_effect,
    reservation_entry_id,
    idempotency_key,
    source,
    metadata_json
  )
  values (
    p_credit_account_id,
    v_reservation.user_id,
    v_reservation.source_analysis_job_id,
    'capture',
    v_credits,
    'none',
    p_reservation_entry_id,
    p_idempotency_key,
    v_reservation.source,
    coalesce(p_metadata_json, '{}'::jsonb) || jsonb_build_object('payload_hash', p_payload_hash)
  )
  returning * into v_entry;

  return query
  select
    v_entry.id,
    v_entry.credit_account_id,
    v_entry.user_id,
    v_entry.source_analysis_job_id,
    v_entry.entry_type,
    v_entry.credits,
    v_entry.balance_effect,
    v_entry.reservation_entry_id,
    v_entry.idempotency_key,
    v_entry.source,
    v_entry.metadata_json,
    v_entry.created_at,
    false;
end;
$$;

create or replace function public.social_reels_credit_release_v1(
  p_credit_account_id uuid,
  p_reservation_entry_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_reason_code text default 'job_failed_schema',
  p_metadata_json jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  credit_account_id uuid,
  user_id uuid,
  source_analysis_job_id uuid,
  entry_type text,
  credits integer,
  balance_effect text,
  reservation_entry_id uuid,
  idempotency_key text,
  source text,
  metadata_json jsonb,
  created_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_ledger_entries%rowtype;
  v_reservation public.credit_ledger_entries%rowtype;
  v_terminal public.credit_ledger_entries%rowtype;
  v_entry public.credit_ledger_entries%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 or p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception 'credit_release_failed';
  end if;

  perform 1
  from public.credit_accounts account
  where account.id = p_credit_account_id
  for update;

  if not found then
    raise exception 'credit_account_missing';
  end if;

  select *
  into v_existing
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if coalesce(v_existing.metadata_json->>'payload_hash', '') <> p_payload_hash then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
    select
      v_existing.id,
      v_existing.credit_account_id,
      v_existing.user_id,
      v_existing.source_analysis_job_id,
      v_existing.entry_type,
      v_existing.credits,
      v_existing.balance_effect,
      v_existing.reservation_entry_id,
      v_existing.idempotency_key,
      v_existing.source,
      v_existing.metadata_json,
      v_existing.created_at,
      true;
    return;
  end if;

  select *
  into v_reservation
  from public.credit_ledger_entries entry
  where entry.id = p_reservation_entry_id
    and entry.credit_account_id = p_credit_account_id
    and entry.entry_type = 'reserve'
  limit 1;

  if not found then
    raise exception 'credit_release_failed';
  end if;

  select *
  into v_terminal
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.reservation_entry_id = p_reservation_entry_id
    and entry.entry_type = 'release'
  order by entry.created_at asc
  limit 1;

  if found then
    return query
    select
      v_terminal.id,
      v_terminal.credit_account_id,
      v_terminal.user_id,
      v_terminal.source_analysis_job_id,
      v_terminal.entry_type,
      v_terminal.credits,
      v_terminal.balance_effect,
      v_terminal.reservation_entry_id,
      v_terminal.idempotency_key,
      v_terminal.source,
      v_terminal.metadata_json,
      v_terminal.created_at,
      true;
    return;
  end if;

  select *
  into v_terminal
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.reservation_entry_id = p_reservation_entry_id
    and entry.entry_type = 'capture'
  limit 1;

  if found then
    raise exception 'credit_release_failed';
  end if;

  insert into public.credit_ledger_entries (
    credit_account_id,
    user_id,
    source_analysis_job_id,
    entry_type,
    credits,
    balance_effect,
    reservation_entry_id,
    idempotency_key,
    source,
    metadata_json
  )
  values (
    p_credit_account_id,
    v_reservation.user_id,
    v_reservation.source_analysis_job_id,
    'release',
    v_reservation.credits,
    'increase_available',
    p_reservation_entry_id,
    p_idempotency_key,
    v_reservation.source,
    coalesce(p_metadata_json, '{}'::jsonb)
      || jsonb_build_object('reason_code', coalesce(nullif(trim(p_reason_code), ''), 'job_failed_schema'))
      || jsonb_build_object('payload_hash', p_payload_hash)
  )
  returning * into v_entry;

  return query
  select
    v_entry.id,
    v_entry.credit_account_id,
    v_entry.user_id,
    v_entry.source_analysis_job_id,
    v_entry.entry_type,
    v_entry.credits,
    v_entry.balance_effect,
    v_entry.reservation_entry_id,
    v_entry.idempotency_key,
    v_entry.source,
    v_entry.metadata_json,
    v_entry.created_at,
    false;
end;
$$;

create or replace function public.social_reels_credit_refund_v1(
  p_credit_account_id uuid,
  p_capture_entry_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_reason_code text default 'job_failed_schema',
  p_metadata_json jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  credit_account_id uuid,
  user_id uuid,
  source_analysis_job_id uuid,
  entry_type text,
  credits integer,
  balance_effect text,
  reservation_entry_id uuid,
  idempotency_key text,
  source text,
  metadata_json jsonb,
  created_at timestamptz,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_ledger_entries%rowtype;
  v_capture public.credit_ledger_entries%rowtype;
  v_prior_refund public.credit_ledger_entries%rowtype;
  v_entry public.credit_ledger_entries%rowtype;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 or p_payload_hash is null or length(trim(p_payload_hash)) = 0 then
    raise exception 'credit_refund_failed';
  end if;

  perform 1
  from public.credit_accounts account
  where account.id = p_credit_account_id
  for update;

  if not found then
    raise exception 'credit_account_missing';
  end if;

  select *
  into v_existing
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.idempotency_key = p_idempotency_key
  limit 1;

  if found then
    if coalesce(v_existing.metadata_json->>'payload_hash', '') <> p_payload_hash then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
    select
      v_existing.id,
      v_existing.credit_account_id,
      v_existing.user_id,
      v_existing.source_analysis_job_id,
      v_existing.entry_type,
      v_existing.credits,
      v_existing.balance_effect,
      v_existing.reservation_entry_id,
      v_existing.idempotency_key,
      v_existing.source,
      v_existing.metadata_json,
      v_existing.created_at,
      true;
    return;
  end if;

  select *
  into v_capture
  from public.credit_ledger_entries entry
  where entry.id = p_capture_entry_id
    and entry.credit_account_id = p_credit_account_id
    and entry.entry_type = 'capture'
  limit 1;

  if not found then
    raise exception 'credit_refund_failed';
  end if;

  select *
  into v_prior_refund
  from public.credit_ledger_entries entry
  where entry.credit_account_id = p_credit_account_id
    and entry.entry_type = 'refund'
    and entry.metadata_json->>'refunded_capture_entry_id' = p_capture_entry_id::text
  order by entry.created_at asc
  limit 1;

  if found then
    return query
    select
      v_prior_refund.id,
      v_prior_refund.credit_account_id,
      v_prior_refund.user_id,
      v_prior_refund.source_analysis_job_id,
      v_prior_refund.entry_type,
      v_prior_refund.credits,
      v_prior_refund.balance_effect,
      v_prior_refund.reservation_entry_id,
      v_prior_refund.idempotency_key,
      v_prior_refund.source,
      v_prior_refund.metadata_json,
      v_prior_refund.created_at,
      true;
    return;
  end if;

  insert into public.credit_ledger_entries (
    credit_account_id,
    user_id,
    source_analysis_job_id,
    entry_type,
    credits,
    balance_effect,
    reservation_entry_id,
    idempotency_key,
    source,
    metadata_json
  )
  values (
    p_credit_account_id,
    v_capture.user_id,
    v_capture.source_analysis_job_id,
    'refund',
    v_capture.credits,
    'increase_available',
    v_capture.reservation_entry_id,
    p_idempotency_key,
    v_capture.source,
    coalesce(p_metadata_json, '{}'::jsonb)
      || jsonb_build_object('reason_code', coalesce(nullif(trim(p_reason_code), ''), 'job_failed_schema'))
      || jsonb_build_object('refunded_capture_entry_id', p_capture_entry_id::text)
      || jsonb_build_object('payload_hash', p_payload_hash)
  )
  returning * into v_entry;

  return query
  select
    v_entry.id,
    v_entry.credit_account_id,
    v_entry.user_id,
    v_entry.source_analysis_job_id,
    v_entry.entry_type,
    v_entry.credits,
    v_entry.balance_effect,
    v_entry.reservation_entry_id,
    v_entry.idempotency_key,
    v_entry.source,
    v_entry.metadata_json,
    v_entry.created_at,
    false;
end;
$$;

revoke all on function public.social_reels_credit_reserve_v1(uuid, integer, text, text, uuid, uuid, text, jsonb) from public;
revoke all on function public.social_reels_credit_capture_v1(uuid, uuid, text, text, integer, jsonb) from public;
revoke all on function public.social_reels_credit_release_v1(uuid, uuid, text, text, text, jsonb) from public;
revoke all on function public.social_reels_credit_refund_v1(uuid, uuid, text, text, text, jsonb) from public;

grant execute on function public.social_reels_credit_reserve_v1(uuid, integer, text, text, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.social_reels_credit_capture_v1(uuid, uuid, text, text, integer, jsonb) to service_role;
grant execute on function public.social_reels_credit_release_v1(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.social_reels_credit_refund_v1(uuid, uuid, text, text, text, jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
