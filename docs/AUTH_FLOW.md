# CutSwitch Auth Flow

## Trial Signup Flow

Unauthenticated `Start Free Trial` CTAs route users to `/start`.

The `/start` page:

- collects email only
- sends a Supabase magic link with `signInWithOtp`
- creates users when needed with `shouldCreateUser: true`
- redirects signed-in users directly to `/pricing` or `/pricing?plan=<plan>`

The magic-link redirect URL is generated as:

```text
<canonical-origin>/auth/callback?plan=<starter|creator_pro|studio>&source=<safe-source>
```

`NEXT_PUBLIC_SITE_URL` is used as the canonical origin when set. Local development falls back to `window.location.origin`.

## Callback Behavior

`/auth/callback` is the only route that exchanges the Supabase `code` for a cookie-backed session.

After a successful callback:

- valid `plan` redirects to `/pricing?plan=<plan>&source=<source>`
- missing or invalid `plan` redirects to `/pricing` or `/pricing?source=<source>`
- `source` is tracking context only and never controls billing behavior

The callback does not allow external redirects.

## Existing Login

`/login` remains the normal email/password account login flow.

Do not replace `/login` with magic-link auth unless the product decision changes.

## Pricing / Checkout

The pricing page already supports `?plan=<plan>` for signed-in auto-checkout.

Stripe Checkout uses the authenticated Supabase user email as `customer_email`, so the checkout customer email matches the account email.

## Manual Supabase Dashboard Setup

These steps must be done in Supabase. They are not repo changes.

### Redirect Allowlist

Add these redirect URLs:

```text
http://localhost:3000/auth/callback
https://cutswitch-site.vercel.app/auth/callback
https://cutswitch.com/auth/callback
```

Only include `https://cutswitch.com/auth/callback` if that domain is active.

### Site URL

Set the Supabase Site URL to the canonical production URL:

```text
https://cutswitch-site.vercel.app
```

or:

```text
https://cutswitch.com
```

Use the custom domain if it is the active canonical site.

### Magic-Link Email Template

The Supabase magic-link template must use `{{ .ConfirmationURL }}` exactly.

Do not manually build a URL with `{{ .SiteURL }}` and a `code` query param. Supabase generates the correct callback URL in `{{ .ConfirmationURL }}` from `emailRedirectTo`.

Recommended subject:

```text
Start your CutSwitch trial
```

Recommended email copy:

```text
Welcome to CutSwitch.

Click below to finish signing in and start your free trial.

Continue to CutSwitch

If the button does not work, copy and paste this link:
{{ .ConfirmationURL }}

If you did not request this, you can ignore this email.
```

### Branded Sender / SMTP

Supabase's default sender looks generic. For a production SaaS experience, configure custom SMTP later with a branded sender such as:

```text
CutSwitch <login@cutswitch.com>
```

or:

```text
CutSwitch <support@cutswitch.com>
```

Professional SaaS teams typically use a branded sender domain, one clear CTA, a fallback link, and no generic provider-looking template.
