# CutSwitch Admin Dashboard Slice Plan

The full product/admin vision lives in `docs/CutSwitch_Admin_Dashboard_Pro_Spec.md`. This slice plan keeps implementation intentionally small so the admin dashboard becomes useful without turning into a sprawling analytics project.

## Phase 1A: Core Slice Now

Build the private founder/operator control surface:

- `/admin` protected by Supabase cookie SSR auth and `ADMIN_EMAILS`.
- `/admin/users` with searchable, paginated user/account table.
- `/admin/feedback` with feedback filters and status updates.
- `POST /api/feedback` for authenticated app/site feedback intake.
- Basic protected exports:
  - `/api/admin/export/users.csv`
  - `/api/admin/export/feedback.csv`
  - `/api/admin/export/feedback-branch-ready.md`
  - `/api/admin/export/feedback-ai.jsonl`
- SQL migration for `feedback_events` and `admin_events`.
- Simple actionable signals only: Active, Stuck, Near quota, Heavy user, Trial inactive.

Do not change billing/trial behavior in this phase.

## Phase 1B-A: Product Signal Intake

Add the gold-signal event stream that makes Phase 1A more accurate without expanding the dashboard surface area:

- `product_events` SQL migration with RLS enabled.
- `POST /api/product-events` authenticated intake endpoint.
- Admin overview stuck signals powered by product events when present.
- Users table last product event and last active date from product events, usage, and jobs.
- No nudges, AI automation, email sending, or complex scoring.

## Phase 1B-B: Detail And Error Depth

Add the drilldowns that make support/debugging faster:

- `/admin/users/[id]` user detail page.
- `/admin/jobs` jobs/errors page.
- `/admin/feedback/branch-ready` action-oriented branch-ready feedback view.
- Timeline of safe user events, usage, feedback, and failures.
- Basic failure grouping and safe app-version/error clues.
- More Codex-task-friendly branch-ready Markdown and AI JSONL exports.

Keep deeper timelines, admin notes, and regression analysis for later if real usage proves they are needed.

## Phase 1C: Polish And Hardening

Tighten the existing admin core without adding major new product surface area:

- Improve visual hierarchy, compact cards, readable tables, and action-oriented empty/loading states.
- Make `/admin` answer the founder questions quickly: who is using, who is stuck, who may churn, and who loves it.
- Add data-health checks for missing plans, missing subscription rows, missing job durations, product event freshness, and obvious webhook gaps.
- Keep admin data server-rendered and `Cache-Control: no-store`.
- Keep previews truncated in list views and reserve full user-provided feedback for protected admin-only views/exports.
- Confirm no secrets, tokens, raw file paths, transcript content, audio content, raw FCPXML, provider keys, or raw webhook payloads are exposed.

## Phase 2: Segments And Intelligence

Add higher-signal segmentation after core data is proven useful:

- Nudges page.
- Churn risk page.
- Heavy users page.
- Love signals.
- AI summaries/classification for feedback.
- Better repeated-theme grouping.
- Segment exports for outreach, not automated sending.

## Phase 3: Lifecycle And Email Integrations

Add lifecycle tooling only after suppression/compliance needs are clear:

- Resend transactional emails for specific product/account events.
- Loops or Customer.io for lifecycle campaigns.
- Suppression/unsubscribe handling.
- Campaign analytics.
- Admin-triggered sending with audit logs and guardrails.

## Guardrails

- Admin data is server-side only.
- Supabase service role key never reaches the browser.
- Use editing time/editing hours in admin UI.
- Keep raw audio, transcripts, private file paths, tokens, secrets, and raw webhook payloads out of admin UI/logs.
- Prefer tables, ranked lists, and exports over vanity charts.

## Phase 2A: Smart User Segments

Add server-derived segments without email sending, AI automation, or billing changes:

- `/admin/segments` segment card dashboard.
- `/admin/segments/[slug]` filtered segment detail pages.
- Segments for trial-never-ran, imported-not-completed, failed-twice, ran-once-not-returned, near-quota, heavy-users, trial-exhausted, paid-near-limit, love-signals, branch-ready feedback, and cancellation risk.
- UI-only scores: stuck, churn risk, love, and heavy user.
- Protected CSV exports for all segments, churn risk, heavy users, and love signals.

These segments prepare contextual nudges later; they do not send emails in Phase 2A.

## Phase 2B: Feedback Intelligence

Turn feedback into deterministic, branch-ready product work without calling an LLM:

- Add optional triage fields on `feedback_events`: title, summary, product area, suggested owner, suggested branch, reproduction likelihood, recommended next action, Codex-ready flag, customer impact, and admin priority.
- Let admins edit feedback intelligence fields from `/admin/feedback`.
- Record admin edits in `admin_events`.
- Improve `/admin/feedback/branch-ready` with richer triage cards and safe context.
- Improve branch-ready Markdown export into Codex-task format.
- Improve AI-friendly JSONL export with deterministic/manual fields.
- Add simple repeated-theme grouping by type, product area, and repeated keywords.

No email sending, AI classification, or billing changes in this phase.

## Phase 2C: Contextual Nudge Queue

Prepare contextual nudge drafts without sending anything:

- Add `nudge_events` for draft/reviewed/suppressed/sent-placeholder queue state.
- Generate draft candidates from admin segments while avoiding duplicate drafts for the same user/type/segment within 7 days.
- Add `/admin/nudges` review queue with copy, mark-reviewed, and suppress actions.
- Add `/api/admin/export/nudges.csv` protected export.
- Keep email sending, bulk actions, Resend, Loops, and Customer.io out of scope.

## Phase 3A: Safe One-Off Nudge Sending

Add carefully gated Resend sending for reviewed nudge drafts only:

- Add `email_suppressions` and extend `nudge_events` with a real `sent` status.
- Add server-only Resend helper using `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Add suppression guard before send; suppressed users are not emailed.
- Add `POST /api/admin/nudges/:id/send` for reviewed, unsent, unsuppressed nudges only.
- Update `/admin/nudges` with confirmation-based one-off send action.
- Keep bulk sending, lifecycle campaigns, and marketing automation out of scope.

Unsubscribe/preferences remain temporary through support contact until a dedicated route exists.

## Phase 3B: Lifecycle Campaign Integration Prep

Prepare lifecycle events for an external campaign platform without replacing Resend transactional email:

- Add `lifecycle_events` as a server-side event ledger.
- Add provider-neutral lifecycle adapter with `LIFECYCLE_PROVIDER=none|loops|customerio`.
- Choose Loops as the first implemented provider path.
- Keep Customer.io provider-specific API marked unresolved until selected.
- Add `/admin/lifecycle` to inspect recent lifecycle records, provider status, and failed sends.
- Emit safe lifecycle events from Stripe subscription webhooks, product events, transcript completion, trial exhaustion, near-quota checks, repeated failures, and praise feedback.
- Do not send transcript content, raw project paths, raw FCPXML, tokens, provider secrets, or private local filenames.

[Unresolved] `user_signed_up` and `trial_never_ran_day_2` need either a server-side signup route/webhook or a scheduled job before they can be emitted reliably.
[Unresolved] Customer.io API sending is not implemented in Phase 3B; use Loops or `none`.

## Phase 3C: Safe Segmented Email Broadcasts

Add reviewed segmented campaign sending with guardrails:

- Add `email_campaigns` and `email_campaign_recipients` for audited campaign state.
- Add `/admin/email`, `/admin/email/new`, and `/admin/email/[id]`.
- Support only known admin segments: trial never ran, imported not completed, failed twice, near quota, heavy users, love signals, and canceled users.
- Require dry-run preview before draft creation.
- Require draft review before final send.
- Require explicit `SEND` confirmation before final send.
- Respect `email_suppressions`; suppressed and invalid recipients are skipped.
- Send sequentially through Resend with recipient status tracking and admin audit events.
- Keep lifecycle campaigns, bulk automation, and external campaign orchestration out of this pass.

Compliance note: campaign emails append support/contact opt-out language. A dedicated unsubscribe/preference route is still [Unresolved]. Consent assumptions must be reviewed before broad marketing use.
