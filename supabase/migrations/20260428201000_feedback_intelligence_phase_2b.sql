-- CutSwitch Admin Dashboard Phase 2B feedback intelligence fields.
-- Run in Supabase SQL editor or through your migration workflow.

alter table public.feedback_events
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists product_area text check (product_area is null or product_area in (
    'onboarding',
    'import',
    'transcription_or_analysis',
    'run',
    'export',
    'billing',
    'account',
    'website',
    'performance',
    'unclear'
  )),
  add column if not exists suggested_owner text,
  add column if not exists suggested_branch_name text,
  add column if not exists reproduction_likelihood text check (reproduction_likelihood is null or reproduction_likelihood in ('unknown', 'low', 'medium', 'high')),
  add column if not exists recommended_next_action text,
  add column if not exists codex_ready boolean not null default false,
  add column if not exists customer_impact text,
  add column if not exists admin_priority text check (admin_priority is null or admin_priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists idx_feedback_events_product_area on public.feedback_events(product_area);
create index if not exists idx_feedback_events_admin_priority on public.feedback_events(admin_priority);
create index if not exists idx_feedback_events_codex_ready on public.feedback_events(codex_ready);
