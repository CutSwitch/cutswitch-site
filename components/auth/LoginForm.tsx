"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useSupabaseSession } from "@/components/auth/useSupabaseSession";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { supabase, configError } = useSupabaseSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next");
  const plan = params.get("plan");

  function nextUrl() {
    if (next?.startsWith("/") && plan) return `${next}?plan=${encodeURIComponent(plan)}`;
    if (next?.startsWith("/")) return next;
    return "/account";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError(configError || "Supabase browser auth is not configured.");
      return;
    }

    setLoading(true);

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Account created. Check your email to confirm, then sign in.");
      return;
    }

    router.push(nextUrl());
  }

  async function sendReset() {
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError(configError || "Supabase browser auth is not configured.");
      return;
    }

    if (!email) {
      setError("Enter your email first, then we can send a reset link.");
      return;
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("Password reset email sent.");
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface-2 p-6 sm:p-8">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Email</span>
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Password</span>
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
          />
        </label>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
        {message ? <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">{message}</div> : null}

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Working..." : mode === "signin" ? "Sign In" : "Create account"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/65">
        <button className="underline decoration-white/20 hover:decoration-white/60" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create account" : "I already have an account"}
        </button>
        <button className="underline decoration-white/20 hover:decoration-white/60" type="button" onClick={sendReset}>
          Forgot password?
        </button>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-white/45">
        Need the Mac app? <Link className="underline" href="/download">Download CutSwitch</Link>, then sign in with this account.
      </p>
    </div>
  );
}
