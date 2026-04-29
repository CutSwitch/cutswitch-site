# CutSwitch Admin Dashboard Pro Spec

**Document purpose:** Design a professional founder/operator admin dashboard for CutSwitch that surfaces the highest-signal product, billing, usage, support, and feedback data without becoming a bloated enterprise analytics tool.

**Product context:** CutSwitch is a macOS app plus website/backend SaaS for podcast and multicam editing. Users sign in, subscribe through Stripe, receive editing-time allowances, and use those hours when CutSwitch creates a new analyzed edit/transcript/diarization. Internally the backend may continue to use transcript/source-duration seconds. User-facing language should say **editing time** or **editing hours**.

**Current stack:**

- Website/backend: Next.js App Router on Vercel
- Auth: Supabase Auth
- Database: Supabase Postgres
- Billing: Stripe subscriptions
- App: macOS SwiftUI
- Email provider candidate: Resend first, then Loops or Customer.io when lifecycle campaigns become real

---

## 1. Executive Summary

The CutSwitch admin dashboard should be a mission-control surface for a founder, not a generic analytics maze. It should answer four questions quickly:

1. **Who is using the product?**
2. **Who is stuck?**
3. **Who is about to churn?**
4. **Who loves it?**

The dashboard exists to help you make fast product, support, and growth decisions. It should not drown you in ornamental charts or dashboards that look impressive but do not change what you do next.

### What this dashboard is for

The admin dashboard should help you:

- See active users, trial users, paid users, canceled users, and heavy users.
- Track editing-time usage, failed jobs, retries, and reuse behavior.
- Identify users who are blocked before first value.
- Spot bugs and UX confusion from feedback and job failures.
- Prepare contextual nudges without sending reckless bulk emails.
- Export data cleanly for analysis, support, AI summarization, and investor/customer reporting.

### What decisions it helps you make

The dashboard should make these decisions obvious:

- Who needs support right now?
- Which errors are blocking adoption?
- Which feedback should become a branch or Codex task?
- Which users are trialing but not activating?
- Which paid users are likely to churn?
- Which users are power users who may upgrade or become testimonials?
- Which product areas need polish before beta expansion?

### What not to build yet

Do **not** build these in Phase 1:

- A full CRM.
- Bulk marketing email blasting.
- Complex cohort analytics.
- A dozen charts that nobody acts on.
- Advanced AI classification that blocks shipping.
- Team roles and permissions beyond admin email allowlist.
- Deep billing controls that Stripe already handles.

Build the sharpest version of the small thing first.

---

## 2. Admin Dashboard Principles

### 2.1 Gold data first

Gold data is data that changes a decision. If a metric does not help you support a user, improve the product, protect costs, or increase conversion, it is not gold.

### 2.2 Actionable over ornamental

Every card/table should imply an action:

- Contact this user.
- Fix this bug.
- Improve this screen.
- Watch this cohort.
- Export this segment.
- Convert this feedback into a Codex task.

### 2.3 Privacy-safe by default

Do not store raw audio, transcripts, user project paths, or private file names unless absolutely required and explicitly consented. Favor metadata:

- User ID
- App version
- Screen/context
- Error code
- Duration seconds
- Safe project fingerprint
- Job status
- Reason code

### 2.4 Server-side only for admin data

Admin data should not be fetched directly from the browser using broad keys. The dashboard must use server-side routes, admin authorization, and the Supabase service role key only on the server.

### 2.5 No secrets exposed

Never expose:

- Supabase service role key
- Stripe secret key
- Stripe webhook secret
- Provider API keys
- User access/refresh tokens
- Raw webhook payloads

### 2.6 Explain what broke

For failed jobs and feedback, admin UI should always try to show:

- What happened
- Where it happened
- Why it matters
- Recommended next action

### 2.7 Prepared for nudges, not spam

The dashboard should segment users and prepare nudge workflows. Phase 1 should export segments and recommended messages. Later phases can integrate Resend, Loops, or Customer.io.

---

## 3. Information Architecture

Recommended top-level admin sections:

```text
/admin
  Overview
  Users
  Usage
  Jobs & Errors
  Feedback
  Branch-Ready
  Churn Risk
  Love Signals
  Heavy Users
  Nudges
  Billing
  Exports
  Settings
```

### 3.1 Overview

A single command center showing:

- Total users
- Trial users
- Paid users
- Active subscriptions
- Editing hours used this period
- Failed jobs
- Reused edits
- Estimated provider cost
- Churn-risk users
- Branch-ready feedback count
- Users stuck before first run

### 3.2 Users

Table of all users with plan, status, usage, last activity, activation state, and risk/love/stuck scores.

### 3.3 Usage

Editing-time usage, remaining allowances, usage by plan, near-quota users, trial usage, and provider cost estimate.

### 3.4 Jobs & Errors

Transcript/edit jobs, export jobs if available, failures, repeated errors, retry patterns, and top error codes.

### 3.5 Feedback

All in-app/user feedback, classified by type, severity, sentiment, screen, and recommended action.

### 3.6 Branch-Ready

Feedback or bug reports that are structured enough to become immediate app/backend branches or Codex tasks.

### 3.7 Churn Risk

Users likely to churn based on inactivity, repeated failures, trial exhaustion, cancellation, low success, or negative feedback.

### 3.8 Love Signals

Praise, high usage, repeat success, low failure rate, testimonials, and users who may be good for case studies.

### 3.9 Heavy Users

Top users by editing time, runs, exports, cost, and usage vs allowance. Useful for upsell, abuse detection, and customer discovery.

### 3.10 Nudges

Segment definitions, suggested messages, channel, status, and exportable recipient lists.

### 3.11 Billing

Stripe-linked status, plan, trialing, active, canceled, past due, next renewal/end date, and billing portal links.

### 3.12 Exports

Download CSV, JSONL, and Markdown exports for analysis, AI processing, and support workflows.

---

## 4. The Gold Data Model

### 4.1 Identity data

**What to collect**

- user_id
- email
- display_name, if available
- signup date
- auth provider
- country/region if safely available
- plan and subscription status

**Why it matters**

Identity data lets you segment users and communicate with them.

**Where stored**

- `users`
- `subscriptions`

**Sensitivity**

High. Email is PII. Treat it carefully.

**Retention**

Keep while the account exists. Honor deletion requests.

**Answers**

- Who is using the product?
- Who is trialing, paid, or canceled?

### 4.2 Activation data

**What to collect**

- first_project_imported_at
- first_run_started_at
- first_successful_edit_at
- first_export_created_at
- last_active_at

**Why it matters**

Activation is the path from curiosity to value. The most important product funnel is:

```text
signup -> import project -> run analysis -> successful edit -> export -> repeat
```

**Where stored**

- `product_events`
- derived into admin views

**Sensitivity**

Medium. Use safe event names and avoid raw paths.

**Retention**

12 to 24 months for analytics, unless user deletion request applies.

**Answers**

- Who is using the product?
- Who is stuck before first value?

### 4.3 Usage data

**What to collect**

- editing time used
- editing time remaining
- plan allowance
- trial allowance
- successful transcript/analyze jobs
- reused transcript jobs
- failed jobs
- duration_seconds
- provider_job_id, if privacy-safe

**Why it matters**

This protects your costs and shows user value.

**Where stored**

- `usage_events`
- `transcript_jobs`
- `subscriptions`
- `plans`

**Sensitivity**

Medium. Usage metadata is less sensitive than content but still customer data.

**Retention**

Billing/usage ledger should be retained longer than general analytics. Consider 7 years for billing-adjacent records, depending on legal/accounting needs.

**Answers**

- Who is using the product?
- Who is heavy?
- Who is near quota?
- What is the provider cost?

### 4.4 Failure/friction data

**What to collect**

- failed job count
- error_code
- error_message_safe
- screen/context
- app_version
- retry count
- time-to-failure
- failure stage: import, analyze, pyannote, export, auth, billing, account

**Why it matters**

Failed jobs are silent churn. Users often leave instead of complaining.

**Where stored**

- `transcript_jobs`
- `product_events`
- `support_events`

**Sensitivity**

Medium to high depending on message content. Redact paths and user-specific file names.

**Retention**

12 to 24 months, longer for billing-impacting events.

**Answers**

- Who is stuck?
- Which bugs matter most?
- Which app version regressed?

### 4.5 Feedback data

**What to collect**

- type: bug, idea, confusion, praise, pricing, onboarding, performance, export, account
- message
- screen/context
- app version
- user_id
- sentiment
- severity
- AI summary fields
- optional attachment metadata

**Why it matters**

Feedback is the direct voice of the user. It tells you what to fix, build, and clarify.

**Where stored**

- `feedback_events`
- optional `admin_notes`

**Sensitivity**

High if users include personal/project details. Encourage minimal, privacy-safe submission.

**Retention**

Keep while useful. Consider anonymization or deletion windows for sensitive feedback.

**Answers**

- Who loves it?
- Who is confused?
- What should become a branch?

### 4.6 Billing data

**What to collect**

- plan_id
- subscription status
- stripe_customer_id
- stripe_subscription_id
- current_period_start
- current_period_end
- trialing/active/canceled/past_due
- cancellation date/reason if available

**Why it matters**

Billing state controls access, conversion, and churn.

**Where stored**

- `subscriptions`
- Stripe remains the payment source of truth

**Sensitivity**

High. Do not store card details. Stripe handles payment methods.

**Retention**

Billing retention according to legal/accounting obligations.

**Answers**

- Who may churn?
- Who is trialing?
- Who is paid?

---

## 5. Data Schema Proposal

Use Supabase Postgres. Keep schemas explicit and searchable.

### 5.1 Existing or expected tables

#### `users`

```sql
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now(),
  last_seen_at timestamptz,
  first_project_imported_at timestamptz,
  first_run_started_at timestamptz,
  first_successful_edit_at timestamptz,
  first_export_created_at timestamptz
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_last_seen_at on public.users(last_seen_at);
```

#### `subscriptions`

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id text references public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create unique index if not exists idx_subscriptions_stripe_subscription_id
  on public.subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;
```

#### `plans`

```sql
create table if not exists public.plans (
  id text primary key,
  name text not null,
  monthly_transcript_seconds integer not null,
  monthly_price_cents integer not null,
  created_at timestamptz default now()
);
```

User-facing copy should say editing time. Internal field names can remain transcript-based to avoid refactor risk.

#### `transcript_jobs`

```sql
create table if not exists public.transcript_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_fingerprint text not null,
  audio_fingerprint text not null,
  speaker_count integer,
  duration_seconds integer not null,
  billable_seconds integer not null default 0,
  status text not null default 'queued',
  provider text default 'pyannote',
  provider_job_id text,
  error_code text,
  error_message text,
  app_version text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_transcript_jobs_user_id on public.transcript_jobs(user_id);
create index if not exists idx_transcript_jobs_status on public.transcript_jobs(status);
create index if not exists idx_transcript_jobs_created_at on public.transcript_jobs(created_at);
create index if not exists idx_transcript_jobs_audio_fingerprint on public.transcript_jobs(audio_fingerprint);
```

#### `usage_events`

```sql
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  idempotency_key text unique not null,
  billable_seconds integer not null default 0,
  project_fingerprint text,
  transcript_job_id uuid references public.transcript_jobs(id),
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_usage_events_user_id on public.usage_events(user_id);
create index if not exists idx_usage_events_event_type on public.usage_events(event_type);
create index if not exists idx_usage_events_created_at on public.usage_events(created_at);
```

#### `exports`

```sql
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  transcript_job_id uuid references public.transcript_jobs(id),
  project_fingerprint text not null,
  transcript_fingerprint text,
  output_kind text default 'fcpxmld',
  app_version text,
  diagnostics_summary_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_exports_user_id on public.exports(user_id);
create index if not exists idx_exports_created_at on public.exports(created_at);
```

### 5.2 New tables for admin intelligence

#### `feedback_events`

```sql
create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type text not null,
  message text not null,
  screen text,
  context_json jsonb default '{}'::jsonb,
  app_version text,
  severity text default 'normal',
  sentiment text,
  status text default 'new',
  source text default 'app',
  attachment_metadata_json jsonb default '{}'::jsonb,

  ai_title text,
  ai_summary text,
  ai_category text,
  ai_severity text,
  ai_suggested_owner text,
  ai_suggested_branch_name text,
  ai_reproduction_likelihood text,
  ai_recommended_next_action text,
  ai_should_be_codex_task boolean default false,
  ai_confidence numeric,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_feedback_events_user_id on public.feedback_events(user_id);
create index if not exists idx_feedback_events_type on public.feedback_events(type);
create index if not exists idx_feedback_events_status on public.feedback_events(status);
create index if not exists idx_feedback_events_ai_category on public.feedback_events(ai_category);
create index if not exists idx_feedback_events_created_at on public.feedback_events(created_at);
```

Recommended `type` values:

```text
bug
idea
confusion
praise
pricing
onboarding
performance
export
account
other
```

Recommended `status` values:

```text
new
triaged
branch_ready
in_progress
shipped
closed
deferred
```

#### `product_events`

```sql
create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  screen text,
  app_version text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_product_events_user_id on public.product_events(user_id);
create index if not exists idx_product_events_event_name on public.product_events(event_name);
create index if not exists idx_product_events_created_at on public.product_events(created_at);
```

Recommended event names:

```text
app_opened
project_imported
speaker_count_confirmed
analysis_started
analysis_succeeded
analysis_failed
export_created
feedback_submitted
account_opened
billing_portal_opened
pricing_opened
```

#### `admin_notes`

```sql
create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  note text not null,
  created_at timestamptz default now()
);

create index if not exists idx_admin_notes_target on public.admin_notes(target_type, target_id);
```

#### `nudge_events`

```sql
create table if not exists public.nudge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  segment_key text not null,
  channel text not null,
  status text not null default 'prepared',
  message_template_key text,
  sent_at timestamptz,
  suppressed_reason text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_nudge_events_user_id on public.nudge_events(user_id);
create index if not exists idx_nudge_events_segment_key on public.nudge_events(segment_key);
create index if not exists idx_nudge_events_status on public.nudge_events(status);
```

#### `support_events`

```sql
create table if not exists public.support_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type text not null,
  subject text,
  message text,
  status text default 'open',
  source text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_support_events_user_id on public.support_events(user_id);
create index if not exists idx_support_events_status on public.support_events(status);
```

#### `admin_events`

```sql
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
```

---

## 6. Feedback System Design

### 6.1 In-app feedback entry point

Add a small, persistent but quiet feedback button in the app:

```text
Give Feedback
```

Recommended placement:

- Account menu: good for general feedback.
- Results/error screens: best for contextual feedback.
- Failed job error card: best for bug reports.

### 6.2 Feedback modal

Keep it short. Users should not need a support ritual.

```text
Help us improve CutSwitch

What happened?
[textarea]

Type
[Bug] [Idea] [Confusing] [Praise] [Billing] [Export]

Optional:
[ ] Include app version and safe diagnostics

[Send Feedback]
```

### 6.3 Captured fields

```json
{
  "user_id": "uuid",
  "type": "bug | idea | confusion | praise | pricing | onboarding | performance | export | account | other",
  "message": "User-provided text",
  "screen": "Project | Match | Group | Cut Style | Run | Results | Account | Website",
  "context": {
    "appVersion": "1.0.0",
    "buildNumber": "...",
    "subscriptionStatus": "trialing | active | canceled",
    "planId": "starter | creator_pro | studio",
    "lastJobStatus": "succeeded | failed | reused",
    "errorCode": "optional",
    "projectFingerprint": "optional safe hash"
  },
  "severity": "low | normal | high | critical",
  "sentiment": "negative | neutral | positive",
  "created_at": "timestamp"
}
```

### 6.4 AI-friendly feedback output

The admin dashboard should be able to export feedback as JSONL for AI analysis:

```jsonl
{"id":"...","userEmail":"support@cutswitch.com","type":"bug","screen":"Run","message":"It failed after upload","aiTitle":"Run fails after upload","aiSummary":"User reports the analysis step fails immediately after upload.","aiCategory":"analysis_failure","aiSeverity":"high","aiSuggestedOwner":"app/backend","aiSuggestedBranchName":"fix-run-upload-failure","aiReproductionLikelihood":"medium","aiRecommendedNextAction":"Check transcript_jobs failures for same user and error code.","aiShouldBeCodexTask":true,"createdAt":"..."}
```

### 6.5 AI classification fields

Use these fields either through manual triage first or later through an AI classifier:

- `ai_title`
- `ai_summary`
- `ai_category`
- `ai_severity`
- `ai_suggested_owner`
- `ai_suggested_branch_name`
- `ai_reproduction_likelihood`
- `ai_recommended_next_action`
- `ai_should_be_codex_task`
- `ai_confidence`

### 6.6 Branch-ready criteria

Feedback is branch-ready when it has:

- Clear category
- Reproduction clue or affected screen
- Severity
- Suggested owner
- Recommended next action

Example branch-ready card:

```text
Run fails after upload
Category: analysis_failure
Severity: high
Owner: app/backend
Suggested branch: fix-run-upload-failure
Action: Inspect transcript_jobs for same error code and reproduce using fixture.
[Create Codex Prompt]
```

---

## 7. Admin Feedback Views

### 7.1 Feedback Inbox

Default view for all new feedback.

Filters:

- Type
- Severity
- Sentiment
- Screen
- Plan
- Trial/paid
- Has job failure nearby
- Has AI summary
- Branch-ready

Sort options:

- Newest
- Highest severity
- Most repeated theme
- Paid users first
- Users with failed jobs first

### 7.2 Bugs

Only bug/performance/export/account failures.

Columns:

- Title
- User
- Plan
- Screen
- Severity
- App version
- Related failure count
- Suggested owner
- Status

### 7.3 Feature Requests

Show ideas by repeated themes.

Useful grouping:

- Editing taste/control
- Export/FCPXML
- Onboarding/import
- Billing/usage
- Team/workflow

### 7.4 Confusion Points

This is conversion gold. Users who are confused are telling you where UX is leaking.

Examples:

- “I do not understand editing time.”
- “Why do I need to sign in?”
- “Where is my output?”
- “What does speaker count mean?”

### 7.5 Branch-Ready Queue

Cards that can become code tasks.

Each card should include:

- Problem statement
- User quote
- Impact
- Suggested branch name
- Suggested Codex prompt
- Related logs/events

### 7.6 Testimonials/Praise

Collect love signals:

- Praise feedback
- High usage with low failure
- Repeat successful edits
- Users willing to talk

Fields:

- Quote
- User
- Plan
- Usage
- Can contact?
- Status: candidate, requested, approved, published

### 7.7 Repeated Themes

Group feedback semantically or by manual tag.

Example output:

```text
Theme: Results output confusion
Mentions: 7
Affected screens: Results
Common sentiment: confused
Recommended action: Add clearer output/reveal state.
```

---

## 8. Contextual Nudge System

Phase 1 should prepare segments. Do not blast emails yet.

### 8.1 Trial user never ran first project

**Trigger condition**

- status = trialing
- created_at older than 24 hours
- no `analysis_succeeded`

**Intent**

Help them reach first value.

**Channel**

Email or in-app.

**Example copy**

```text
Subject: Ready to create your first CutSwitch edit?

You have 4 hours of editing time in your trial. Import a Final Cut project and CutSwitch will help generate your first podcast edit.
```

**Guardrails**

Do not send more than once in 48 hours.

### 8.2 Imported project but did not complete run

**Trigger condition**

- `project_imported`
- no `analysis_succeeded` within 24 hours

**Intent**

Find friction.

**Example copy**

```text
Need help finishing your first CutSwitch run?
If anything was confusing, reply and tell us where you got stuck.
```

**Guardrails**

One nudge. Prefer in-app feedback prompt if user opens app again.

### 8.3 Failed job twice

**Trigger condition**

- two failed `transcript_jobs` within 24 hours

**Intent**

Support rescue.

**Channel**

Admin task first, email second.

**Example copy**

```text
We noticed your CutSwitch run hit an issue. If you want, send us the safe diagnostics and we’ll help troubleshoot.
```

**Guardrails**

Do not mention internal provider names unless needed.

### 8.4 Low editing time remaining

**Trigger condition**

- active/trial
- remainingSeconds below threshold

Thresholds:

- Paid: below 10 percent allowance
- Trial: below 30 minutes

**Intent**

Prevent blocked workflow.

**Example copy**

```text
You’re running low on editing time.
Upgrade before your next long episode so your workflow does not pause mid-project.
```

**Guardrails**

Do not send if user has already upgraded or canceled.

### 8.5 Trial editing time exhausted

**Trigger condition**

- trialing
- remainingSeconds <= 0

**Intent**

Conversion.

**Example copy**

```text
Your trial editing time is used up.
Choose a plan to keep creating CutSwitch edits.
```

**Guardrails**

One direct nudge. Keep it calm.

### 8.6 Paid user near quota

**Trigger condition**

- active paid
- usage > 80 percent allowance

**Intent**

Upgrade.

**Example copy**

```text
You’re close to your monthly editing-time limit.
Studio gives you more room for longer shows and multiple clients.
```

### 8.7 Heavy user upsell

**Trigger condition**

- top 10 percent usage
- low failure rate
- repeat edits

**Intent**

Upgrade or founder conversation.

**Example copy**

```text
You’re one of our heaviest CutSwitch users. Want to tell us what would make this even better for your workflow?
```

### 8.8 Canceled user reactivation

**Trigger condition**

- canceled
- had successful edits
- no active subscription

**Intent**

Learn why, possibly win back.

**Example copy**

```text
Quick question: what made you stop using CutSwitch?
Your feedback directly shapes what we fix next.
```

### 8.9 Praise/testimonial

**Trigger condition**

- praise feedback
- high love score

**Intent**

Testimonial.

**Example copy**

```text
Thanks for the kind words. Would you be open to us using a short quote about your CutSwitch experience?
```

### 8.10 Export error

**Trigger condition**

- export_created failed or export event error

**Intent**

Support and bug triage.

**Guardrails**

Do not over-email. Surface in admin first.

---

## 9. Email and Broadcast Strategy

### Can the admin dashboard send specialized emails to segments?

Yes, but not in Phase 1 as a fully automated broadcaster.

### Phase 1: Export and prepare

Build:

- Segment lists
- CSV export
- Copyable recipient list
- Suggested nudge copy
- Suppression status placeholder

Do not send bulk email yet from the dashboard.

### Phase 2: Transactional/contextual via Resend

Use Resend for event-based messages:

- trial started
- trial editing time exhausted
- subscription active
- failed job support message
- feedback received

### Phase 3: Lifecycle campaigns via Customer.io or Loops

Use a lifecycle tool when you need:

- drip sequences
- segmentation
- unsubscribe management
- campaign analytics
- suppression lists

### Compliance notes

- Marketing emails need unsubscribe.
- Transactional emails can be sent for account/product events, but keep them limited and relevant.
- Respect unsubscribed/suppressed users.
- Keep a suppression list.
- Do not email users repeatedly from admin without clear intent.

### Recommended email data model

```text
nudge_events.status:
prepared | sent | suppressed | failed

nudge_events.channel:
email | in_app | admin_task
```

---

## 10. Dashboard UX Wireframe

### 10.1 Overview page

```text
/admin

[Date range: 7d | 30d | Billing period] [Refresh]

Cards:
- Total users
- Trial users
- Paid users
- Editing hours used
- Failed jobs
- Estimated provider cost
- Churn-risk users
- Branch-ready feedback

Two-column layout:

Left:
- Activation funnel
  Signup -> Imported -> Ran -> Successful edit -> Exported -> Returned
- Stuck users
  Trial never ran
  Imported but never completed
  Failed twice

Right:
- Heavy users
- Near quota users
- Love signals
- Top errors
```

### 10.2 Users table

```text
/admin/users

Filters:
Plan | Status | Trial/Paid | Stuck | Churn risk | Heavy | Love signal

Table:
Email | Plan | Status | Used | Remaining | Success Jobs | Failed Jobs | Last Active | Scores | Actions
```

Actions:

- View user
- Export row
- Add note
- Prepare nudge

### 10.3 User detail page

```text
/admin/users/[id]

Header:
Email
Plan badge
Status
Last active

Cards:
- Editing time used/remaining
- First successful edit
- Failed jobs
- Reuse rate
- Churn risk
- Love score

Timeline:
- signup
- login
- project imported
- analysis started
- analysis succeeded/failed
- export created
- feedback submitted

Side panel:
- Admin notes
- Feedback
- Suggested nudges
```

### 10.4 Feedback inbox

```text
/admin/feedback

Tabs:
Inbox | Bugs | Ideas | Confusion | Praise | Branch-ready

Card:
AI title
User quote
Category
Severity
Screen
Suggested owner
Recommended next action
[Make Codex Task] [Mark triaged] [Add note]
```

### 10.5 Branch-ready queue

```text
/admin/feedback/branch-ready

Each card:
Problem
Impact
User quote
Suggested branch
Suggested Codex prompt
Related events
[Copy Codex Prompt]
```

### 10.6 Jobs and errors view

```text
/admin/jobs

Cards:
Failed jobs today
Failure rate
Top error code
Users affected

Table:
Created | User | Status | Duration | Error | App Version | Related Feedback | Action
```

### 10.7 Churn risk view

```text
/admin/churn-risk

Segments:
- Trial no run
- Failed twice
- Usage exhausted
- Paid inactive
- Canceled after success

Table:
User | Reason | Plan | Last success | Last failure | Suggested nudge
```

### 10.8 Heavy users view

```text
/admin/heavy-users

Table:
User | Plan | Used | Remaining | Cost estimate | Success jobs | Reuse rate | Upsell suggestion
```

### 10.9 Nudges page

```text
/admin/nudges

Segments:
- Trial never ran
- Imported but no run
- Failed twice
- Low editing time
- Trial exhausted
- Heavy users

Each segment:
Count
Recommended channel
Example copy
[Export CSV]
[Copy message]
```

---

## 11. Visual Design Direction

Use the CutSwitch website style:

- Dark, premium, focused.
- Cards with restrained borders and subtle gradients.
- Dense tables, but readable.
- Clear hierarchy and badges.
- Purple accent only for primary actions.
- Amber for warning/trial/attention.
- Red only for failures, danger, or blocked states.
- No flashy vanity graphs.
- No confetti dashboard aesthetics.

### Suggested visual language

- Status badges: trialing, active, canceled, past_due.
- Plan badges: Starter, Creator Pro, Studio.
- Risk badges: low, medium, high.
- Feedback tags: bug, idea, confusion, praise.
- Score cards: stuck score, love score, churn risk.

### Chart types to use sparingly

- Funnel chart for activation.
- Small bar chart for usage by plan.
- Line chart for daily successful edits.
- Ranked list for top errors.

Avoid pie charts unless there are only three to four categories.

---

## 12. Metrics and Formulas

### 12.1 Activation rate

```text
activation_rate = users_with_first_successful_edit / total_signed_up_users
```

### 12.2 First successful edit rate

```text
first_successful_edit_rate = users_with_first_successful_edit / users_who_imported_project
```

### 12.3 Failed job rate

```text
failed_job_rate = failed_transcript_jobs / total_transcript_jobs
```

### 12.4 Retry rate

```text
retry_rate = users_with_multiple_attempts_after_failure / users_with_failed_jobs
```

### 12.5 Reuse rate

```text
reuse_rate = reused_transcript_jobs / total_successful_or_reused_jobs
```

### 12.6 Editing hours used

```text
editing_hours_used = sum(usage_events.billable_seconds where event_type = 'transcript_succeeded') / 3600
```

### 12.7 Editing hours remaining

For paid:

```text
remaining = plan.monthly_transcript_seconds - used_this_period_seconds
```

For trial:

```text
remaining = 14400 - used_trial_seconds
```

### 12.8 Cost estimate

```text
estimated_provider_cost = editing_hours_used * PYANNOTE_COST_PER_HOUR
```

If actual provider pricing varies by model, store per-provider and per-model rates later.

### 12.9 Gross margin estimate

```text
gross_margin = subscription_revenue - estimated_provider_cost - payment_fees
```

### 12.10 Churn risk score

Start with a simple 0 to 100 score:

```text
churn_risk_score =
  +25 if trial user has no successful edit after 48h
  +20 if failed jobs >= 2 in 24h
  +20 if paid user inactive for 14d
  +15 if remaining editing time = 0
  +15 if negative feedback submitted
  +10 if billing status past_due
  -20 if successful edit in last 7d
  -15 if praise feedback submitted
```

Clamp to 0 to 100.

### 12.11 Stuck score

```text
stuck_score =
  +30 if imported project but no successful run
  +25 if failed jobs >= 2
  +20 if repeated same error code
  +15 if confusion feedback
  +10 if no activity after signup
```

### 12.12 Love score

```text
love_score =
  +25 if praise feedback
  +20 if repeat successful edits
  +20 if high reuse rate
  +15 if active paid user
  +10 if no failures in last 5 jobs
```

### 12.13 Heavy user score

```text
heavy_user_score =
  percentile_rank(editing_hours_used) * 0.6
  + percentile_rank(successful_jobs) * 0.4
```

---

## 13. Admin Access and Security Design

### 13.1 Route

```text
/admin
```

### 13.2 Admin allowlist

Use an environment variable:

```text
ADMIN_EMAILS=support@cutswitch.com,jamison@example.com
```

### 13.3 Server-side admin checks

Admin pages and APIs should:

1. Require Supabase auth session.
2. Derive user from token/session.
3. Verify email is in `ADMIN_EMAILS`.
4. Fetch admin data server-side.
5. Return 403 for non-admin users.

### 13.4 Service role key

Use the Supabase service role key only in server-side admin data loaders/API routes. Never expose it to client components.

### 13.5 RLS considerations

Because admin queries need broader access, fetch with server-side admin client. Public/client Supabase queries should still rely on RLS for user-owned data.

### 13.6 Audit log

Record admin actions in `admin_events`:

- exported CSV
- viewed user detail
- changed feedback status
- copied Codex prompt
- prepared nudge
- sent email, in later phases

### 13.7 Privacy and redaction

Admin UI should not show raw:

- file paths
- source audio
- transcripts
- user tokens
- raw webhook payloads
- provider secrets

---

## 14. Export and Download Design

Admin should be able to export:

### 14.1 Users CSV

Fields:

- user_id
- email
- plan
- subscription_status
- signup_date
- first_successful_edit_at
- last_active_at
- editing_hours_used
- editing_hours_remaining
- success_jobs
- failed_jobs
- churn_risk_score
- love_score
- stuck_score

### 14.2 Usage CSV

Fields:

- user_id
- email
- event_type
- billable_seconds
- editing_hours
- project_fingerprint
- created_at

### 14.3 Feedback CSV

Fields:

- id
- user_email
- type
- severity
- sentiment
- screen
- message
- ai_summary
- recommended_next_action
- status
- created_at

### 14.4 Failed jobs CSV

Fields:

- job_id
- user_email
- status
- error_code
- error_message_safe
- app_version
- duration_seconds
- created_at

### 14.5 Branch-ready feedback Markdown

Each item should export as:

```md
## Fix run failure after upload

- User: support@cutswitch.com
- Type: Bug
- Severity: High
- Screen: Run
- Suggested branch: fix-run-upload-failure

### User quote
> It failed right after uploading.

### AI summary
The user reports that analysis fails after upload.

### Recommended next action
Inspect transcript_jobs for same error code and reproduce with fixture.

### Codex task prompt
...
```

### 14.6 AI-friendly JSONL

Use JSONL so it can be fed to AI tools without transforming the data.

```jsonl
{"kind":"feedback","id":"...","summary":"...","category":"bug","severity":"high","shouldBecomeCodexTask":true}
{"kind":"user_signal","userId":"...","stuckScore":75,"churnRiskScore":60,"recommendedNudge":"failed_job_support"}
```

---

## 15. MVP vs Later Phases

### Phase 1: Must build now

Build the founder/operator core:

- `/admin` protected by `ADMIN_EMAILS`
- Overview cards
- Users table
- User detail page
- Jobs/errors table
- Feedback intake endpoint
- `feedback_events` table
- Feedback inbox
- Branch-ready feedback queue
- CSV/JSONL/Markdown exports
- Basic scores: stuck, churn risk, love, heavy user
- Safe provider cost estimate using `PYANNOTE_COST_PER_HOUR`

### Phase 2: Soon

Add:

- In-app feedback button in macOS app
- Nudge segments page
- Export segment CSV
- Admin notes
- Resend transactional emails for specific events
- Trial exhaustion and failed-job support nudges
- Better charts and date filters

### Phase 3: Later

Add:

- Customer.io or Loops lifecycle campaigns
- AI classifier for feedback
- Team/admin roles
- More advanced cohort analytics
- Billing recovery workflows
- Support ticket integration
- Segment-level email sending with compliance tooling

---

## 16. Codex-Ready Implementation Prompt for Phase 1

```text
Goal:
Implement Phase 1 of the CutSwitch Admin Dashboard in the existing cutswitch-site website repo.

Scope:
Website repo only. Next.js App Router. Supabase Auth + Supabase Postgres. Stripe subscription data already exists. Do not modify macOS app in this pass. Minimal diff, but complete enough to be useful.

Core purpose:
Build a private founder/operator admin dashboard at /admin that answers:
1. Who is using the product?
2. Who is stuck?
3. Who is about to churn?
4. Who loves it?

Security requirements:
- /admin must be private.
- Require authenticated Supabase user.
- Allow only emails in ADMIN_EMAILS env var.
- If signed out, redirect to /login?next=/admin.
- If signed in but not admin, return 403.
- Never expose Supabase service role key to client.
- Fetch admin data server-side only.
- No secrets, tokens, raw webhook payloads, raw file paths, or provider keys in UI/logs.

Environment variables:
- ADMIN_EMAILS=support@cutswitch.com,jamison@example.com
- PYANNOTE_COST_PER_HOUR optional. If missing, show: "Set PYANNOTE_COST_PER_HOUR to estimate costs."

Database migrations:
Add tables if missing:
1. feedback_events
2. product_events
3. admin_notes
4. nudge_events
5. admin_events

Use the schema from CutSwitch_Admin_Dashboard_Pro_Spec.md. Add sensible indexes:
- user_id
- created_at
- type/status/category fields

Routes/pages to create:
- app/admin/page.tsx
- app/admin/users/page.tsx
- app/admin/users/[id]/page.tsx
- app/admin/jobs/page.tsx
- app/admin/feedback/page.tsx
- app/admin/feedback/branch-ready/page.tsx
- app/admin/churn-risk/page.tsx
- app/admin/heavy-users/page.tsx
- app/admin/nudges/page.tsx

API routes to create:
- GET /api/admin/overview
- GET /api/admin/users
- GET /api/admin/users/[id]
- GET /api/admin/jobs
- GET /api/admin/feedback
- POST /api/admin/feedback/[id]/status
- GET /api/admin/export/users.csv
- GET /api/admin/export/usage.csv
- GET /api/admin/export/feedback.csv
- GET /api/admin/export/failed-jobs.csv
- GET /api/admin/export/branch-ready.md
- GET /api/admin/export/ai-signals.jsonl
- POST /api/feedback

Feedback endpoint:
POST /api/feedback
Requires Authorization: Bearer token.
Request:
{
  "type": "bug | idea | confusion | praise | pricing | onboarding | performance | export | account | other",
  "message": "string",
  "screen": "string optional",
  "context": { "safe metadata only" },
  "severity": "low | normal | high | critical optional"
}
Behavior:
- Derive user from token.
- Insert feedback_events row.
- Do not require AI classification yet.
- Return { ok: true }.

Admin UI requirements:
- Match existing CutSwitch dark premium style.
- Overview cards:
  - total users
  - trial users
  - paid users
  - editing hours used this period
  - failed jobs
  - reused jobs
  - estimated provider cost
  - churn-risk users
  - branch-ready feedback count
- Users table:
  Email | Plan | Status | Used | Remaining | Successful jobs | Failed jobs | Last active | Stuck | Churn risk | Love
- Jobs/errors table:
  Created | User | Status | Duration | Error code | App version | Action
- Feedback inbox:
  New feedback cards/table with type, message, user, screen, severity, status.
- Branch-ready page:
  Show feedback where ai_should_be_codex_task = true or status = branch_ready.
- Churn risk page:
  Users with high churn risk score.
- Heavy users page:
  Top users by editing time and successful jobs.
- Nudges page:
  Prepare segments only, no bulk email sending yet.

Scoring formulas:
Implement simple derived scores server-side or in admin helper:
- churnRiskScore
- stuckScore
- loveScore
- heavyUserScore
Use the formulas from the spec, but keep implementation simple and transparent.

Export requirements:
Admin can download:
- users CSV
- usage CSV
- feedback CSV
- failed jobs CSV
- branch-ready Markdown
- AI-friendly JSONL

Billing/cost:
- Use editing time language in UI.
- Internally usage_events billable_seconds can remain transcript-based.
- estimated cost = editing_hours_used * PYANNOTE_COST_PER_HOUR.
- If cost env missing, do not fake it.

Docs:
- Add or update docs/API_CONTRACT.md for /api/feedback and admin export routes.
- Add docs/ADMIN_DASHBOARD.md summarizing dashboard purpose, security, and phase plan.

Verification:
Run:
- npm run build
- npm run test:backend if relevant

Manual/admin tests:
- Admin email can view /admin.
- Signed-out user redirects to /login?next=/admin.
- Non-admin signed-in user gets 403.
- Admin pages do not expose service role key or secrets.
- /api/feedback inserts feedback for authenticated user.
- CSV export downloads data.
- JSONL export returns valid JSON lines.
- Branch-ready Markdown export returns Markdown.

Output:
- Files changed
- Database migrations added
- Admin pages added
- API routes added
- Env vars needed
- Build result
- Admin access test result
- Non-admin denial test result
- Feedback submission test result
- Export test result
- Any [Unresolved] items with exact reason
```

---

## 17. Acceptance Criteria

Phase 1 is done when:

- `/admin` exists and is private.
- Only emails in `ADMIN_EMAILS` can access admin pages.
- Signed-out users are redirected to login.
- Non-admin users get 403.
- Dashboard shows total users, trial users, paid users, editing hours used, failed jobs, reused jobs, and cost estimate status.
- Users table shows plan, status, used/remaining editing time, success jobs, failed jobs, last activity, and scores.
- Jobs page surfaces failed jobs and top errors.
- Feedback endpoint accepts authenticated feedback.
- Feedback inbox displays feedback.
- Branch-ready view exists.
- Exports work for users, usage, feedback, failed jobs, branch-ready Markdown, and AI JSONL.
- No secrets appear in client bundles, logs, or unauthenticated responses.
- `npm run build` passes.

---

## 18. Risks

### 18.1 Privacy

Risk: collecting too much user/project information.

Mitigation:

- Store fingerprints, not file paths.
- Keep diagnostics privacy-safe.
- Avoid raw transcript/audio storage.

### 18.2 Over-emailing

Risk: annoying users with premature nudges.

Mitigation:

- Phase 1 exports only.
- Add suppression lists before direct campaign sending.
- Separate transactional from marketing email.

### 18.3 Admin-only data leaks

Risk: dashboard data accidentally visible to public users.

Mitigation:

- Server-side admin checks.
- `ADMIN_EMAILS` allowlist.
- No service role key in client.
- 403 for non-admin.

### 18.4 Fake or vanity metrics

Risk: beautiful charts that do not change action.

Mitigation:

- Every metric needs an action.
- Prefer tables and ranked lists.

### 18.5 Misclassifying feedback

Risk: AI or rules mislabel feedback.

Mitigation:

- Start with manual classification.
- Add AI summary fields as optional.
- Show confidence.

### 18.6 Building too much before beta

Risk: admin dashboard becomes a project bigger than the product.

Mitigation:

- Build Phase 1 only.
- No full CRM.
- No campaign automation yet.

### 18.7 Sensitive cost assumptions

Risk: inaccurate provider cost estimate.

Mitigation:

- Use `PYANNOTE_COST_PER_HOUR` env.
- Show when estimate is not configured.
- Do not hardcode unknown costs.

---

## 19. Final Recommendation

Build Phase 1 in this order:

1. **Admin access control**
   - `/admin`, `ADMIN_EMAILS`, server-side checks.
   - Reason: security first. No admin data leaks.

2. **Overview + users table**
   - Reason: immediately answers who is using and who is paying.

3. **Jobs/errors view**
   - Reason: failed jobs are the fastest path to churn.

4. **Feedback endpoint + feedback inbox**
   - Reason: feedback is the highest-leverage qualitative data.

5. **Exports**
   - Reason: exportable data lets you analyze, summarize, and act without overbuilding.

6. **Branch-ready queue**
   - Reason: turns user feedback into Codex/app branches quickly.

Do not implement bulk email sending yet. Prepare segments and exports first. The admin dashboard should become your calm little control tower, not a carnival of charts.
