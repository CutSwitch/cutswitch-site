-- CutSwitch Admin Dashboard Phase 2C contextual nudge queue.
-- Review queue only. This does not send email.

create table if not exists public.nudge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  nudge_type text not null check (nudge_type in (
    'trial_never_ran',
    'imported_not_completed',
    'failed_twice',
    'low_editing_time_remaining',
    'trial_editing_time_exhausted',
    'paid_user_near_quota',
    'heavy_user_upsell',
    'canceled_user_reactivation',
    'praise_testimonial_request',
    'export_error_followup'
  )),
  channel text not null default 'email',
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'suppressed', 'sent_placeholder')),
  trigger_reason text,
  subject text,
  message text,
  segment_key text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  sent_at timestamptz,
  suppressed_at timestamptz
);

create index if not exists idx_nudge_events_user_created_at on public.nudge_events(user_id, created_at desc);
create index if not exists idx_nudge_events_type_status on public.nudge_events(nudge_type, status);
create index if not exists idx_nudge_events_segment_key on public.nudge_events(segment_key);
create index if not exists idx_nudge_events_created_at on public.nudge_events(created_at desc);

alter table public.nudge_events enable row level security;
