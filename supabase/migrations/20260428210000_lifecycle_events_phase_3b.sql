-- CutSwitch Admin Dashboard Phase 3B lifecycle campaign integration prep.
-- Events are server-side only and safe for lifecycle email platforms.

create table if not exists public.lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null check (event_name in (
    'user_signed_up',
    'trial_started',
    'first_project_imported',
    'first_run_started',
    'first_run_succeeded',
    'trial_never_ran_day_2',
    'trial_exhausted',
    'paid_subscription_started',
    'near_quota',
    'canceled_subscription',
    'feedback_praise_received',
    'repeated_failure'
  )),
  provider text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  sent_at timestamptz,
  error_message text
);

create index if not exists idx_lifecycle_events_user_created_at on public.lifecycle_events(user_id, created_at desc);
create index if not exists idx_lifecycle_events_event_created_at on public.lifecycle_events(event_name, created_at desc);
create index if not exists idx_lifecycle_events_status_created_at on public.lifecycle_events(status, created_at desc);
create index if not exists idx_lifecycle_events_created_at on public.lifecycle_events(created_at desc);

alter table public.lifecycle_events enable row level security;
