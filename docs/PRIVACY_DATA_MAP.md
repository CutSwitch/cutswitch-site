# CutSwitch Privacy Data Map

This document is an operational privacy map for CutSwitch. It is not legal advice; it is a practical source of truth for what we collect, why, where it lives, and how to handle deletion/export requests.

## Principles

- Collect the smallest useful dataset.
- Store fingerprints and safe metadata instead of raw audio, transcripts, file paths, or FCPXML.
- Keep service-role/admin access server-side only.
- Treat admin exports as sensitive support/legal artifacts.
- Preserve billing records where required for accounting, tax, fraud, disputes, or legal obligations.

## Data Inventory

| Data type | Location / provider | Purpose | Sensitivity | Retention target | Deletion / minimization behavior |
| --- | --- | --- | --- | --- | --- |
| Account auth | Supabase Auth, `users` | Login, account access, admin allowlist checks | High | While account exists | Delete/anonymize on verified deletion request unless required for legal records |
| Email address | Supabase, Stripe, Resend, admin tables | Account, billing, support, lifecycle messages | High | While account exists or suppression needed | Delete/anonymize where possible; keep suppression email/hash as needed to honor opt-out |
| Billing metadata | Stripe, `subscriptions`, `plans` | Subscriptions, trials, billing status, support | High | Longer billing/accounting period | Preserve required accounting/tax/dispute records; remove app-only copies where practical |
| Usage/editing-time ledger | `usage_events`, `transcript_jobs` | Plan enforcement, usage display, fraud/support | Medium | Billing-adjacent; longer than analytics | Delete/anonymize user link where legally allowed; preserve minimal ledger if required |
| Product events | `product_events` | Activation, stuck-user detection, product quality | Medium | 12-24 months target | Delete or anonymize by user on verified request unless needed for security/legal |
| Feedback | `feedback_events` | Product improvement, support, admin triage | High if user includes private details | Keep while useful; review periodically | Delete/anonymize on request; avoid storing private raw content beyond what user submits |
| Support messages | Resend/email inbox, support route metadata | Customer support, privacy requests, troubleshooting | High | Keep while useful for support/legal | Delete where practical; support attachments should be minimized |
| Support attachments | Resend/email inbox | Troubleshooting with user consent | High | Short as practical | Delete when no longer needed; never treat as permanent storage |
| Lifecycle events | `lifecycle_events`, lifecycle provider if enabled | Customer lifecycle messaging and status | Medium | 12-24 months target | Delete/anonymize by user unless needed for compliance |
| Nudges/campaigns | `nudge_events`, `email_campaigns`, `email_campaign_recipients` | Admin-reviewed contextual emails | High because includes email | Campaign/support retention; review periodically | Suppress rather than re-add; delete/anonymize nonessential metadata on request |
| Email suppressions | `email_suppressions` | Honor opt-out/unsubscribe choices | High | As long as needed to honor opt-out | Keep minimal email/user reference; do not delete if deletion would cause re-mailing |
| Affiliate attribution | Rewardful, Stripe metadata | Referral tracking and commissions | Medium | Affiliate/accounting period | Governed by consent; delete/minimize where practical after attribution window/accounting need |
| Checkout/payment cookies | Stripe | Secure checkout and billing portal | High | Provider controlled | Stripe remains payment source of truth |
| Consent/preferences | Browser localStorage | Cookie choices and theme | Low-Medium | Until user clears or updates | User can change via Cookie settings/footer |
| Server logs | Vercel/provider logs | Security, debugging, reliability | Medium | Provider-limited/log policy | Avoid logging tokens, raw payloads, private paths, or content |

## Privacy Request Handling

1. Receive request through `/support` with topic `privacy` or at `privacy@cutswitch.com`.
2. Verify requester identity before exporting, correcting, deleting, or disclosing account information.
3. Export relevant account, subscription, usage, feedback, support, product-event, lifecycle, and email preference records.
4. Delete or anonymize app/customer data where legally allowed.
5. Preserve billing, tax, accounting, fraud, dispute, security, and legal records where required.
6. Record admin-only handling notes in `admin_events` or a privacy request tracker if one is added later.

## Admin Export Rules

- Admin exports are for support, privacy, security, legal, investor/customer reporting, or internal product analysis only.
- Do not share raw exports outside CutSwitch support/legal workflows.
- Do not paste customer exports into third-party AI tools unless the data is minimized or the tool/provider has been approved for that use.
- Exports should never include service role keys, tokens, raw webhook payloads, raw audio, transcript text, raw local file paths, provider keys, or raw FCPXML.

## Email Compliance Notes

- Transactional emails: account, billing, security, support, legal notices, and product operation.
- Nonessential emails: lifecycle nudges, campaigns, marketing updates, testimonial requests, and upsell messages.
- Nonessential emails must honor `email_suppressions`.
- Marketing campaigns require `BUSINESS_POSTAL_ADDRESS` before final send.
- Email footers should include support and unsubscribe links.

## Manual / Legal Follow-Up

- Have counsel review Privacy Policy, Cookie Policy, Terms, Refund Policy, and email compliance language before relying on them.
- Confirm processor agreements / DPAs for Supabase, Stripe, Vercel, Resend, Rewardful, and any lifecycle provider.
- Decide the canonical privacy inbox: `privacy@cutswitch.com` or support topic routing.
- Define retention automation later; this v1 documents targets but does not add deletion jobs.
