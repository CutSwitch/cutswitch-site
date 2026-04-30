-- CutSwitch feedback submission fields for logged-in feature requests.
-- Database remains the source of truth; email is only a notification path.

alter table public.feedback_events
  add column if not exists user_email text,
  add column if not exists title text,
  add column if not exists current_page text,
  add column if not exists app_area text,
  add column if not exists admin_notes text;

create index if not exists idx_feedback_events_user_email on public.feedback_events(user_email);
create index if not exists idx_feedback_events_new_created_at
  on public.feedback_events(created_at desc)
  where status = 'new';

alter table public.feedback_events enable row level security;
