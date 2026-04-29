"use client";

import { useState } from "react";

const STATUSES = ["new", "reviewed", "branch_ready", "resolved", "ignored"];

export function FeedbackStatusControl({ id, status }: { id: string; status: string }) {
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
    }
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
    </div>
  );
}
