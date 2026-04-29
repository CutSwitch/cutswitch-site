"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { useSupabaseSession } from "@/components/auth/useSupabaseSession";

type Props = {
  mobile?: boolean;
};

export function NavAuth({ mobile = false }: Props) {
  const { supabase, session, user, loading } = useSupabaseSession();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const email = user?.email ?? "Account";

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setIsAdmin(false);
      return;
    }

    let alive = true;
    fetch("/api/account/admin-status", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { isAdmin?: boolean };
        if (alive) setIsAdmin(res.ok && data.isAdmin === true);
      })
      .catch(() => {
        if (alive) setIsAdmin(false);
      });

    return () => {
      alive = false;
    };
  }, [session?.access_token]);

  async function signOut() {
    setOpen(false);
    await supabase?.auth.signOut();
  }

  async function openBilling() {
    setBillingError(null);
    const token = session?.access_token;

    if (!token) {
      setBillingError("Sign in to manage billing.");
      return;
    }

    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { portalUrl?: string; error?: string };

    if (!res.ok || !data.portalUrl) {
      setBillingError(data.error || "Unable to open billing.");
      return;
    }

    window.location.href = data.portalUrl;
  }

  if (loading) {
    return <div className={cn("h-9 rounded-full bg-white/5", mobile ? "w-full" : "w-28")} />;
  }

  if (!user) {
    return (
      <div className={cn("flex gap-2", mobile ? "grid" : "items-center")}>
        <Link className={mobile ? "btn btn-secondary w-full" : "btn btn-secondary"} href="/login">
          Log In
        </Link>
        <Link className={mobile ? "btn btn-primary w-full" : "btn btn-primary"} href="/pricing">
          Try It Free
          <span className="text-white/80">→</span>
        </Link>
      </div>
    );
  }

  if (mobile) {
    return (
      <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="truncate px-1 text-sm font-semibold text-white/90">{email}</div>
        <Link className="btn btn-secondary w-full" href="/account">
          Dashboard
        </Link>
        {isAdmin ? (
          <Link className="btn btn-secondary w-full" href="/admin">
            Admin
          </Link>
        ) : null}
        <button className="btn btn-secondary w-full" type="button" onClick={openBilling}>
          Billing
        </button>
        <button className="btn btn-ghost w-full" type="button" onClick={signOut}>
          Sign Out
        </button>
        {billingError ? <div className="text-xs text-red-200">{billingError}</div> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand/60"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="truncate">{email}</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#0E1020]/95 p-2 shadow-soft backdrop-blur">
          <Link className="block rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-white" href="/account">
            Dashboard
          </Link>
          {isAdmin ? (
            <Link className="block rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-white" href="/admin">
              Admin
            </Link>
          ) : null}
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white"
            type="button"
            onClick={openBilling}
          >
            Billing
          </button>
          <button
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white"
            type="button"
            onClick={signOut}
          >
            Sign Out
          </button>
          {billingError ? <div className="px-3 py-2 text-xs text-red-200">{billingError}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
