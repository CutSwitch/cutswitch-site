-- CutSwitch Admin Dashboard Phase 3C segmented email campaign safeguards.
-- Campaigns are admin-only, reviewed before sending, suppression-aware, and audited.

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_markdown text not null,
  segment_key text not null,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'sending', 'sent', 'canceled')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  sent_at timestamptz
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'suppressed', 'invalid', 'sent', 'failed', 'skipped')),
  suppression_reason text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_email_campaigns_status_created_at on public.email_campaigns(status, created_at desc);
create index if not exists idx_email_campaigns_segment_key on public.email_campaigns(segment_key);
create index if not exists idx_email_campaign_recipients_campaign_id on public.email_campaign_recipients(campaign_id);
create index if not exists idx_email_campaign_recipients_user_id on public.email_campaign_recipients(user_id);
create index if not exists idx_email_campaign_recipients_email on public.email_campaign_recipients(email);
create index if not exists idx_email_campaign_recipients_status on public.email_campaign_recipients(status);

alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
