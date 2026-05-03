-- Production schema repair for admin signal intake.
-- Safe to run more than once; keeps API-created tables aligned with the repo schema.

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type text not null,
  message text not null,
  screen text,
  context_json jsonb default '{}'::jsonb,
  app_version text,
  severity text default 'normal',
  status text default 'new',
  source text default 'app',
  attachment_metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.feedback_events
  add column if not exists user_email text,
  add column if not exists title text,
  add column if not exists current_page text,
  add column if not exists app_area text,
  add column if not exists admin_notes text,
  add column if not exists summary text,
  add column if not exists product_area text,
  add column if not exists suggested_owner text,
  add column if not exists suggested_branch_name text,
  add column if not exists reproduction_likelihood text,
  add column if not exists recommended_next_action text,
  add column if not exists codex_ready boolean default false,
  add column if not exists customer_impact text,
  add column if not exists admin_priority text,
  add column if not exists ai_title text,
  add column if not exists ai_summary text,
  add column if not exists ai_category text,
  add column if not exists ai_severity text,
  add column if not exists ai_suggested_owner text,
  add column if not exists ai_suggested_branch_name text,
  add column if not exists ai_reproduction_likelihood text,
  add column if not exists ai_recommended_next_action text,
  add column if not exists ai_should_be_codex_task boolean default false,
  add column if not exists ai_confidence numeric;

create index if not exists idx_feedback_events_user_id on public.feedback_events(user_id);
create index if not exists idx_feedback_events_type on public.feedback_events(type);
create index if not exists idx_feedback_events_status on public.feedback_events(status);
create index if not exists idx_feedback_events_ai_category on public.feedback_events(ai_category);
create index if not exists idx_feedback_events_created_at on public.feedback_events(created_at);
create index if not exists idx_feedback_events_product_area on public.feedback_events(product_area);
create index if not exists idx_feedback_events_codex_ready on public.feedback_events(codex_ready);

alter table public.feedback_events enable row level security;

grant insert, select, update on public.feedback_events to service_role;
grant insert, select on public.feedback_events to authenticated;

drop policy if exists "authenticated users can insert own feedback" on public.feedback_events;
drop policy if exists "authenticated users can read own feedback" on public.feedback_events;
drop policy if exists "service role can insert feedback" on public.feedback_events;
drop policy if exists "service role can read feedback" on public.feedback_events;
drop policy if exists "service_role_feedback_insert" on public.feedback_events;

create policy "authenticated users can insert own feedback"
on public.feedback_events
as permissive
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "authenticated users can read own feedback"
on public.feedback_events
as permissive
for select
to authenticated
using (auth.uid() = user_id);

create policy "service_role_feedback_insert"
on public.feedback_events
as permissive
for insert
to service_role
with check (true);

create policy "service role can read feedback"
on public.feedback_events
as permissive
for select
to service_role
using (true);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  event_type text not null,
  screen text,
  app_version text,
  project_fingerprint text,
  source_duration_seconds integer,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_product_events_user_created on public.product_events(user_id, created_at desc);
create index if not exists idx_product_events_type_created on public.product_events(event_type, created_at desc);
create index if not exists idx_product_events_project_fingerprint on public.product_events(project_fingerprint);
create index if not exists idx_product_events_created_at on public.product_events(created_at desc);

alter table public.product_events enable row level security;

grant insert, select on public.product_events to service_role;
grant insert on public.product_events to authenticated;

drop policy if exists "authenticated users can insert own product events" on public.product_events;
drop policy if exists "service role can insert product events" on public.product_events;

create policy "authenticated users can insert own product events"
on public.product_events
as permissive
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "service role can insert product events"
on public.product_events
as permissive
for insert
to service_role
with check (true);

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_admin_events_admin_user_id on public.admin_events(admin_user_id);
create index if not exists idx_admin_events_created_at on public.admin_events(created_at);

alter table public.admin_events enable row level security;

select pg_notify('pgrst', 'reload schema');
