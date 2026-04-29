-- CutSwitch Admin Dashboard Phase 1A
-- Run in Supabase SQL editor or through your migration workflow.

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('bug', 'idea', 'confusion', 'praise', 'pricing', 'onboarding', 'performance', 'export', 'account')),
  message text not null,
  screen text,
  context_json jsonb not null default '{}'::jsonb,
  app_version text,
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'reviewed', 'branch_ready', 'resolved', 'ignored')),
  source text not null default 'app',
  attachment_metadata_json jsonb not null default '{}'::jsonb,

  ai_title text,
  ai_summary text,
  ai_category text,
  ai_severity text,
  ai_suggested_owner text,
  ai_suggested_branch_name text,
  ai_reproduction_likelihood text,
  ai_recommended_next_action text,
  ai_should_be_codex_task boolean not null default false,
  ai_confidence numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feedback_events_user_id on public.feedback_events(user_id);
create index if not exists idx_feedback_events_type on public.feedback_events(type);
create index if not exists idx_feedback_events_severity on public.feedback_events(severity);
create index if not exists idx_feedback_events_status on public.feedback_events(status);
create index if not exists idx_feedback_events_branch_ready on public.feedback_events(ai_should_be_codex_task, status);
create index if not exists idx_feedback_events_created_at on public.feedback_events(created_at desc);

alter table public.feedback_events enable row level security;

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_events_admin_user_id on public.admin_events(admin_user_id);
create index if not exists idx_admin_events_target on public.admin_events(target_type, target_id);
create index if not exists idx_admin_events_created_at on public.admin_events(created_at desc);

alter table public.admin_events enable row level security;
