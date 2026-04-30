"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["new", "reviewed", "planned", "shipped", "declined", "branch_ready", "resolved", "ignored"];

export function FeedbackStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: string) {
    setValue(next);
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/feedback/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setValue(status);
      setError(data.error || "Unable to update status.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <select
        className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-xs text-white/80 outline-none focus:ring-2 focus:ring-brand/60"
        value={value}
        disabled={busy}
        onChange={(event) => update(event.target.value)}
        aria-label="Feedback status"
      >
        {STATUSES.map((item) => (
          <option key={item} value={item}>{item.replace(/_/g, " ")}</option>
        ))}
      </select>
      {busy ? <div className="text-xs text-white/40">Saving…</div> : null}
      {error ? <div className="text-xs text-red-200">{error}</div> : null}
      <div className="mt-1 grid grid-cols-2 gap-1">
        {[
          ["reviewed", "Review"],
          ["branch_ready", "Branch"],
          ["resolved", "Resolve"],
          ["ignored", "Ignore"],
        ].map(([next, label]) => (
          <button
            key={next}
            type="button"
            disabled={busy || value === next}
            onClick={() => update(next)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/55 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
