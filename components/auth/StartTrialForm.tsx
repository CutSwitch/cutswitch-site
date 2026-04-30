"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useSupabaseSession } from "@/components/auth/useSupabaseSession";
import { buildAuthCallbackPath, buildTrialRedirectPath } from "@/lib/startFlow";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import type { AppPlanId } from "@/lib/plans";

type StartTrialFormProps = {
  plan: AppPlanId | null;
  source: string | null;
  next: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getMagicLinkOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the current browser origin if the public site URL is malformed in local env.
    }
  }
  return window.location.origin;
}

export function StartTrialForm({ plan, source, next }: StartTrialFormProps) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSupabaseSession();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = useMemo(() => buildTrialRedirectPath({ plan, source, next }), [plan, source, next]);

  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace(redirectPath);
    }
  }, [redirectPath, router, sessionLoading, user]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Signup is not configured yet.");
      return;
    }

    setLoading(true);
    try {
      const callbackPath = buildAuthCallbackPath({ plan, source, next });
      const emailRedirectTo = `${getMagicLinkOrigin()}${callbackPath}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo,
        },
      });

      if (otpError) throw otpError;

      setSent(true);
      setEmail("");
    } catch {
      setError("Unable to send magic link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.08] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
        <p className="text-base font-semibold text-emerald-100">
          Check your email to continue.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/64">
          We sent a secure magic link. Open it on this device and we’ll bring you back to CutSwitch.
        </p>
        <button
          type="button"
          className="mt-5 rounded-full px-3 py-1 text-sm font-medium text-brand transition hover:bg-brand/10 hover:underline"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form className="mt-9 w-full space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2 text-left">
        <label className="text-sm font-medium text-white/75" htmlFor="start-email">
          Email
        </label>
        <input
          id="start-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          list="common-email-domains"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
        <datalist id="common-email-domains">
          <option value="@gmail.com" />
          <option value="@icloud.com" />
          <option value="@outlook.com" />
          <option value="@yahoo.com" />
        </datalist>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full justify-center rounded-lg py-3 text-base disabled:cursor-not-allowed disabled:opacity-65"
      >
        {loading ? "Sending..." : "Let’s go"}
      </button>

      <p className="text-center text-xs text-white/45">No spam. Just a magic link.</p>
    </form>
  );
}
