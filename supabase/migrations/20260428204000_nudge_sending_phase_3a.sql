-- CutSwitch Admin Dashboard Phase 3A one-off nudge sending safeguards.
-- Sending is admin-only and one-off. Bulk/lifecycle email remains out of scope.

alter table public.nudge_events
  drop constraint if exists nudge_events_status_check;

alter table public.nudge_events
  add constraint nudge_events_status_check
  check (status in ('draft', 'reviewed', 'suppressed', 'sent_placeholder', 'sent'));

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  email text not null,
  reason text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_suppressions_email on public.email_suppressions(email);
create index if not exists idx_email_suppressions_user_id on public.email_suppressions(user_id);

alter table public.email_suppressions enable row level security;
