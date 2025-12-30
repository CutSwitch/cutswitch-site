"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function SupportForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(e.currentTarget);

    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      topic: String(form.get("topic") || "support"),
      subject: String(form.get("subject") || ""),
      message: String(form.get("message") || ""),
    };

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");

      (e.target as HTMLFormElement).reset();
      setState({
        status: "success",
        message: data.message || "Message sent. We will get back to you as soon as we can.",
      });
    } catch (err: any) {
      setState({ status: "error", message: err?.message || "Failed to send message." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Name</span>
          <input
            name="name"
            required
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
            placeholder="Your name"
          />
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Email</span>
          <input
            name="email"
            type="email"
            required
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
            placeholder="you@company.com"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Topic</span>
          <select
            name="topic"
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
            defaultValue="support"
          >
            <option value="support">Support</option>
            <option value="feedback">Feedback</option>
            <option value="billing">Billing</option>
            <option value="affiliates">Affiliates</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Subject</span>
          <input
            name="subject"
            required
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
            placeholder="What can we help with?"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        <span className="text-white/75">Message</span>
        <textarea
          name="message"
          required
          rows={6}
          className={cn(
            "resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
            "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
          )}
          placeholder="Tell us what happened, what you expected, and anything you'd like us to know."
        />
      </label>

      <button
        className={cn("btn btn-primary w-full sm:w-fit", state.status === "submitting" ? "opacity-70" : "")}
        disabled={state.status === "submitting"}
        type="submit"
      >
        {state.status === "submitting" ? "Sending…" : "Send message"}
      </button>

      {state.status === "success" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {state.message}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {state.message}
        </div>
      )}

      <p className="text-xs text-white/45">
        Note: we do not offer refunds, but we will help you troubleshoot fast. If you're stuck, email{" "}
        <a className="underline decoration-white/20 hover:decoration-white/60" href="mailto:support@cutswitch.com">
          support@cutswitch.com
        </a>
        .
      </p>
    </form>
  );
}
