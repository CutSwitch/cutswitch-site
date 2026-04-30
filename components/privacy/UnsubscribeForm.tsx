"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function UnsubscribeForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Unable to save preference.");
      }
      setState({
        status: "success",
        message: "You are opted out of nonessential CutSwitch emails.",
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Unable to save preference.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span className="text-white/75">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={cn(
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
            "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
          )}
          placeholder="you@example.com"
        />
      </label>

      <button className="btn btn-primary w-full sm:w-fit" type="submit" disabled={state.status === "submitting"}>
        {state.status === "submitting" ? "Saving..." : "Opt out"}
      </button>

      {state.status === "success" ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {state.message}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
