# Social Reels Stripe Credit Mapping

## Scope

This document describes the server-owned mapping from Stripe-backed app plans to included Social Reels credits. It is documentation for Slice 04 only; it does not create Stripe products, change production price IDs, enable overage billing, or alter Social Reels discovery behavior.

## Credit Unit

```text
1 credit = 1 source media minute processed
included monthly credits = plan transcript hours * 60
trial credits = TRIAL_EDITING_SECONDS / 60
```

Credits are granted as ledger entries. Balances remain ledger-derived; there is no stored `current_balance` column.

## Plan Mapping

The repo already defines current app plans in `lib/plans.ts`:

| Plan | Transcript Hours | Included Monthly Credits | Stripe Price Env |
| --- | ---: | ---: | --- |
| `starter` | 15 | 900 | `STRIPE_PRICE_STARTER` |
| `creator_pro` | 50 | 3000 | `STRIPE_PRICE_CREATOR_PRO` |
| `studio` | 120 | 7200 | `STRIPE_PRICE_STUDIO` |

The mapping is implemented in `lib/socialReelsStripeCredits.ts` and resolves Stripe prices through the existing env-owned Stripe price configuration. Unknown price IDs fail safely in mapping tests and do not create credit ledger grants.

## Grant Behavior

Included credits are granted through `grantCredits(...)` in `lib/socialReelsCreditLedger.ts`.

Grant ledger rows use:

```text
entry_type = grant
balance_effect = increase_available
credits = positive included credit amount
source = stripe_monthly_credit_grant or stripe_trial_credit_grant
```

Grant metadata is limited to sanitized Stripe references such as event ID, customer ID, subscription ID, plan ID, subscription status, period timestamps, and `overage_enabled: false`.

## Idempotency

Monthly grants use a stable subscription-period key:

```text
stripe:credits:monthly:<subscription_id>:<period_start>:<plan_id>
```

Trial grants use a one-time subscription key:

```text
stripe:credits:trial:<subscription_id>:<plan_id>
```

The Stripe event ID is still recorded in sanitized metadata. This avoids duplicate credits from webhook replay and from multiple Stripe events describing the same subscription period, such as `customer.subscription.updated` and `invoice.paid`.

## Trial Behavior

For account-backed Stripe trial subscriptions, the backend grants trial credits once:

```text
TRIAL_EDITING_SECONDS / 60 = 240 credits
```

Trial grant replay or subsequent trial updates do not duplicate credits.

## Overage Preparation

Overage billing is explicitly disabled in this slice:

```text
overageEnabled = false
```

Future overage support should add product confirmation, Stripe configuration, ledger entry type usage, idempotency rules, and tests before any charge is created.

## Privacy

Credit grant metadata must not include access tokens, refresh tokens, Authorization headers, raw webhook payloads, raw transcripts, raw word JSON, media paths, cache paths, OpenAI payloads, Whisper payloads, pyannote payloads, or private local paths.

## Rollback

Rollback by reverting the credit grant integration and mapping helper. If grants were written in a deployed environment, correct them through append-only `adjustment` ledger entries rather than deleting historical rows.
