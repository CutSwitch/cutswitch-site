# Social Reels Credit Model

## Purpose

This document proposes the backend credit model for source-minute based Social Reels analysis before adding migrations or changing route behavior.

Current repo context:

- Subscription plans are defined in `lib/plans.ts` and `lib/subscriptions.ts`.
- Existing editing-time usage is recorded through `usage_events.billable_seconds`.
- `POST /api/account/usage` sums `usage_events` for `transcript_succeeded`.
- `POST /api/transcripts/complete` uses idempotency keys and transcript reuse keys to avoid duplicate billing.
- `POST /api/social-reels/discover` currently checks entitlement but does not charge editing time.
- `lib/socialReelsCreditEstimator.ts` currently returns estimate-only duration-bucket line items. The source-minute model below should replace or supersede that estimate behavior in a later implementation slice.

## Credit Unit

One Social Reels credit equals one source media minute processed.

```text
creditsRequired = ceil(sourceDurationSeconds / 60)
minimum charge = 1 credit for any nonzero source
```

Rules:

- Do not charge per clip candidate.
- Do not charge per duration bucket unless product strategy changes later.
- One analysis run can produce many candidates.
- Candidate count is not a cost driver.
- Duration bucket count is not a cost driver in this v1 model.

## Default Charging Recommendation

Use reserve/capture.

1. Validate entitlement and request shape.
2. Compute `creditsRequired` from source media duration.
3. Reuse cache when available and valid; cached regeneration does not full-charge again.
4. Reserve credits before OpenAI/provider work.
5. Run analysis and candidate generation.
6. Capture reserved credits after successful candidate generation.
7. Release reserved credits on provider failure, validation failure, cancellation, or no valid candidates.

Direct debit is simpler but weaker for failure handling. Reserve/capture is safer because Social Reels analysis can fail after the user has passed entitlement checks.

## Included Monthly Credits

Each active subscription plan should map to a monthly included credit allowance. The initial migration can derive allowance from the existing plan minutes/hours convention:

```text
included monthly credits = plan transcriptHours * 60
trial included credits = TRIAL_EDITING_SECONDS / 60
```

This keeps current plan economics aligned while allowing the future API/UI to display credits instead of seconds for Social Reels.

Purchased or overage credits can be added later as grant ledger entries with a purchase, invoice, or admin adjustment source.

## Account Model

Default account owner is the authenticated Supabase `users.id`.

Future team/org support should add an account owner abstraction:

- Personal account: `account_type = 'user'`, `owner_user_id = users.id`
- Team/org account: `account_type = 'organization'`, `organization_id = ...`

All credit jobs and ledger entries should point to a credit account, not directly to a subscription row. Subscription rows grant credits into accounts, but account balances are derived from the ledger.

## Ledger Model

All credit balance changes should be auditable ledger entries.

Recommended entry types:

- `grant`: included plan credits, purchased credits, trial credits
- `reserve`: temporary hold before provider work
- `capture`: conversion of reserved credits after success
- `debit`: direct charge when reserve/capture is not used
- `refund`: return already captured/debited credits
- `release`: release an unused reservation
- `adjustment`: admin/manual balance correction
- `overage`: future paid overage charge

Balance views:

- Available balance = grants + refunds + releases + adjustments - reserves - captures - debits - overages
- Reserved balance = active reserve entries not yet captured or released
- Consumed balance = captures + debits + overages - refunds

Ledger entries must include idempotency keys so a retry cannot duplicate a reserve, capture, debit, refund, release, or grant.

## Job Model

Recommended statuses:

- `created`
- `checking_credits`
- `reserved`
- `running`
- `succeeded`
- `failed`
- `refunded`
- `cached`
- `cancelled`

Each Social Reels source analysis job represents one chargeable source analysis run. One job can produce many candidate reels.

Candidate records are children of the job and are not independently billed.

## Cache Policy

Use `analysis_cache_entries` to avoid full re-charge when the user regenerates candidates from the same source analysis.

Cache identity should include:

- User/account id
- Privacy-safe source fingerprint
- Transcript normalization hash
- Prompt/schema version
- Analysis mode/version
- Relevant bounded word/transcript version metadata

Cached regeneration rules:

- Same source fingerprint and same transcript normalization hash: no full re-charge.
- Same source uploaded twice with the same normalized transcript: should hit cache or create a `cached` job with zero captured credits.
- Same source with changed transcript normalization hash: new analysis charge is allowed because the analyzed input changed.
- Prompt version changes: product decision. Recommended default is no full re-charge for minor prompt changes if the cached source analysis is still valid; charge only if the source must be reprocessed or a new provider run is required.

## Edge Cases

### Source duration is missing

Do not charge until the backend can determine source duration from trusted request metadata or a completed transcript/analysis artifact. Return a validation error or create a `created` job that cannot reserve credits yet.

### Source is under one minute

Any nonzero source costs at least 1 credit.

### Source is extremely long

Enforce a maximum source duration before reservation. The existing code commonly caps media duration at 24 hours; use that as the initial planning cap unless product chooses a stricter Social Reels limit.

### Same source uploaded twice

Use source fingerprint plus transcript normalization hash to detect reuse. If already analyzed successfully, return cached candidates or create a zero-charge `cached` job.

### Same source with changed transcript

Treat as a new analysis identity because the source text/word IDs changed. Charge again unless product explicitly adds a partial-reuse policy.

### OpenAI/provider fails after credits are reserved

Release the reservation. Do not capture.

### OpenAI returns no valid candidates

Release the reservation by default. If product later wants to charge for analysis attempts with zero usable results, that must be an explicit pricing decision.

### Retry with same idempotency key

Return the existing job/ledger outcome. Do not create duplicate ledger entries or duplicate candidates.

### Team/org account versus personal account

Use `credit_accounts` as the account boundary. Personal accounts start first; team/org accounts can share a credit account later without changing job/ledger semantics.

### Cached regeneration after prompt version changes

If only candidate presentation changes and no provider/source reanalysis occurs, no full re-charge. If a new provider analysis run is required, create a new job and reserve/capture credits.

## Logging And Privacy

Logs and reports must not include:

- Access tokens or Authorization headers
- Private file paths
- Raw transcript payloads
- Raw word JSON
- Media paths or cache paths
- API keys
- Whisper or pyannote payloads

Log only privacy-safe ids, hashes, counts, durations, credit amounts, status, and request ids.

## Open Product Questions

- Should Social Reels credits share the same monthly allowance as transcript editing time or become a separate displayed balance?
- How many included monthly credits should each plan show if not mapped 1:1 from existing transcript hours?
- Should a provider run that returns no valid candidates ever consume credits?
- Should minor prompt-version refreshes be free if cached source analysis exists?
- What is the maximum source duration for Social Reels analysis?
- When team/org support arrives, who can spend shared credits and who can view ledger history?
- Should purchased credits expire, roll over, or remain until consumed?
- Should overage be automatic, opt-in, or blocked until purchase?

## Rollback

Rollback by removing this document and the companion schema planning document. No migrations or runtime behavior are introduced in this slice.
