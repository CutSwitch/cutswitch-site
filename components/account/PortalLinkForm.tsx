"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PortalLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage("");

    try {
      const res = await fetch("/api/account/send-portal-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Unable to send link.");

      setState("sent");
      setMessage(
        data.message ||
          "If an account exists for that email, you'll receive a secure link to manage your subscription."
      );
    } catch (err: any) {
      setState("error");
      setMessage(err?.message || "Something went wrong.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm">
        <span className="text-white/75">Email used at checkout</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={cn(
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
            "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
          )}
        />
      </label>

      <button
        className={cn("btn btn-primary w-fit", state === "sending" ? "opacity-70" : "")}
        disabled={state === "sending"}
        type="submit"
      >
        {state === "sending" ? "Sending…" : "Email me a manage link"}
      </button>

      {message ? (
        <div
          className={cn(
            "rounded-xl border p-3 text-sm",
            state === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          )}
        >
          {message}
        </div>
      ) : null}

      <p className="text-xs text-white/45">
        For security, we never show portal links on this page. We email them to the address used at checkout.
      </p>
    </form>
  );
}
