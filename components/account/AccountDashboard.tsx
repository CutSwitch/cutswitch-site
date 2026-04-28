"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useSupabaseSession } from "@/components/auth/useSupabaseSession";

type UsageResponse = {
  subscription: null | {
    plan_id?: string | null;
    status?: string | null;
    stripe_customer_id?: string | null;
  };
  plan: null | {
    name: string;
    transcriptHours: number;
    includedSeconds: number;
  };
  totalUsedSeconds: number;
  remainingSeconds: number | null;
  error?: string;
};

function hours(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "-";
  const value = seconds / 3600;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 })}h`;
}

export function AccountDashboard() {
  const { supabase, session, user, loading, configError } = useSupabaseSession();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    let alive = true;
    setUsageError(null);

    fetch("/api/account/usage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as UsageResponse;
        if (!res.ok) throw new Error(data.error || "Unable to load usage.");
        return data;
      })
      .then((data) => {
        if (alive) setUsage(data);
      })
      .catch((error) => {
        if (alive) setUsageError(error instanceof Error ? error.message : "Unable to load usage.");
      });

    return () => {
      alive = false;
    };
  }, [session?.access_token]);

  async function manageBilling() {
    setBillingError(null);
    const token = session?.access_token;
    if (!token) {
      setBillingError("Sign in to manage billing.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { portalUrl?: string; error?: string };
    setBusy(false);

    if (!res.ok || !data.portalUrl) {
      setBillingError(data.error || "Unable to open billing.");
      return;
    }

    window.location.href = data.portalUrl;
  }

  if (loading) {
    return <div className="card p-6 text-sm text-white/65">Loading account...</div>;
  }

  if (configError) {
    return <div className="card p-6 text-sm text-red-200">{configError}</div>;
  }

  if (!user) {
    return (
      <div className="card p-6">
        <div className="text-lg font-semibold text-white">Sign in required</div>
        <p className="mt-2 text-sm text-white/65">Use your CutSwitch account to view transcript hours and billing.</p>
        <Link className="btn btn-primary mt-5" href="/login?next=/account">
          Log In
        </Link>
      </div>
    );
  }

  const planName = usage?.plan?.name ?? "No active plan";
  const status = usage?.subscription?.status ?? "No subscription";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="card p-6 sm:p-8">
        <div className="text-sm text-white/55">Signed in as</div>
        <div className="mt-1 truncate text-xl font-semibold text-white">{user.email}</div>

        {usageError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{usageError}</div> : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Current plan</div>
            <div className="mt-2 text-lg font-semibold text-white">{planName}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Status</div>
            <div className="mt-2 text-lg font-semibold capitalize text-white">{status.replace(/_/g, " ")}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Used this period</div>
            <div className="mt-2 text-lg font-semibold text-white">{hours(usage?.totalUsedSeconds)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-white/45">Remaining</div>
            <div className="mt-2 text-lg font-semibold text-white">{hours(usage?.remainingSeconds)}</div>
          </div>
        </div>

        <p className="mt-5 text-sm text-white/60">
          Transcript hours are used only when CutSwitch creates a new transcript. Reused transcripts do not count again.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 p-6">
        <div className="text-lg font-semibold text-white">Quick actions</div>
        <div className="mt-5 grid gap-3">
          <button className="btn btn-primary w-full" type="button" onClick={manageBilling} disabled={busy}>
            {busy ? "Opening..." : "Manage Billing"}
          </button>
          <Link className="btn btn-secondary w-full" href="/download">
            Download Mac App
          </Link>
          <button className="btn btn-ghost w-full" type="button" onClick={() => supabase?.auth.signOut()}>
            Sign Out
          </button>
        </div>
        {billingError ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{billingError}</div> : null}
      </div>
    </div>
  );
}
