"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    rewardful?: (...args: any[]) => void;
  }
}

type SessionInfo = {
  email?: string | null;
  mode?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
  plan?: string | null;
};

export function SuccessClient({ sessionId }: { sessionId: string }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const res = await fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as SessionInfo & { error?: string };
        if (!res.ok) throw new Error(data.error || "Unable to load receipt details.");
        if (!alive) return;

        setInfo(data);

        // Optional client-side conversion tracking.
        if (data.email) {
          try {
            window.rewardful?.("convert", { email: data.email });
          } catch {
            // ignore
          }
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Something went wrong.");
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <div className="text-sm font-semibold text-emerald-100">Payment successful</div>
        <p className="mt-2 text-sm text-emerald-100/80">
          Thanks for supporting CutSwitch. Your license will be delivered by email shortly.
        </p>

        {info?.email ? (
          <div className="mt-4 text-sm text-emerald-100/80">
            License email will be sent to: <span className="font-semibold">{info.email}</span>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Next: download and activate</div>
          <p className="mt-2 text-sm text-white/65">
            Download the macOS app, open it, and paste your license key from the email. If you do not receive it within
            a couple minutes, contact Support.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-primary" href="/download">
              Download for macOS <span className="text-white/80">→</span>
            </Link>
            <Link className="btn btn-secondary" href="/support">
              Contact Support
            </Link>
          </div>

          <p className="mt-4 text-xs text-white/45">
            Note: we do not issue refunds. If something is broken, we will help you fix it quickly.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Receipt details</div>
          <p className="mt-2 text-sm text-white/65">
            Session ID: <span className="font-mono text-xs text-white/70">{sessionId}</span>
          </p>

          {info ? (
            <div className="mt-4 grid gap-2 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span className="text-white/55">Plan</span>
                <span>{info.plan || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/55">Mode</span>
                <span>{info.mode || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/55">Total</span>
                <span>
                  {typeof info.amountTotal === "number" && info.currency
                    ? `${(info.amountTotal / 100).toFixed(2)} ${info.currency.toUpperCase()}`
                    : "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className={cn("mt-4 text-sm text-white/55")}>Loading…</div>
          )}

          <div className="mt-6 gradient-line" />

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-ghost" href="/account">
              Manage subscription
            </Link>
            <Link className="btn btn-ghost" href="/affiliates">
              Affiliate program
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
