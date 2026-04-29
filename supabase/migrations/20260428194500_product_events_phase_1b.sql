-- CutSwitch Admin Dashboard Phase 1B-A product signal intake.
-- Run in Supabase SQL editor or through your migration workflow.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'app_opened',
    'signed_in',
    'project_imported',
    'speaker_count_confirmed',
    'run_clicked',
    'run_blocked_no_plan',
    'run_blocked_insufficient_time',
    'run_started',
    'run_succeeded',
    'run_failed',
    'transcript_reused',
    'export_created',
    'feedback_opened',
    'feedback_submitted'
  )),
  screen text,
  app_version text,
  project_fingerprint text,
  source_duration_seconds integer check (source_duration_seconds is null or source_duration_seconds >= 0),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_events_user_created_at on public.product_events(user_id, created_at desc);
create index if not exists idx_product_events_type_created_at on public.product_events(event_type, created_at desc);
create index if not exists idx_product_events_project_fingerprint on public.product_events(project_fingerprint);
create index if not exists idx_product_events_created_at on public.product_events(created_at desc);

alter table public.product_events enable row level security;
