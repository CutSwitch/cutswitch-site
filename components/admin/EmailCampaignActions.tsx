"use client";

import { useState } from "react";

export function EmailCampaignActions({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(action: "review" | "test" | "send") {
    setBusy(action);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/email/${id}/${action}`, {
      method: "POST",
      headers: action === "send" ? { "Content-Type": "application/json" } : undefined,
      body: action === "send" ? JSON.stringify({ confirmation }) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: number };
    setBusy(null);
    if (!res.ok) {
      setError(data.error || `Unable to ${action} campaign.`);
      return;
    }
    if (action === "test") {
      setNotice("Test email sent to your admin email.");
      return;
    }
    if (action === "send") {
      setNotice(`Send complete: ${data.sent || 0} sent, ${data.failed || 0} failed.`);
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <h3 className="text-lg font-semibold text-white">Campaign actions</h3>
      <p className="text-sm leading-6 text-white/55">Send a test first. Final send only works after review and requires typing SEND.</p>
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <button className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15" type="button" onClick={() => post("review")} disabled={busy !== null}>
            {busy === "review" ? "Reviewing..." : "Mark reviewed"}
          </button>
        ) : null}
        <button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 hover:bg-white/5" type="button" onClick={() => post("test")} disabled={busy !== null}>
          {busy === "test" ? "Sending..." : "Send test to admin"}
        </button>
      </div>
      {status === "reviewed" ? (
        <div className="grid gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 p-4">
          <label className="grid gap-2 text-sm text-red-50">
            Type SEND to confirm final send
            <input className="rounded-xl border border-red-200/20 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-300/50" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button className="rounded-xl border border-red-200/25 bg-red-400/20 px-3 py-2 text-sm font-semibold text-red-50 hover:bg-red-400/25 disabled:opacity-50" type="button" onClick={() => post("send")} disabled={busy !== null || confirmation !== "SEND"}>
            {busy === "send" ? "Sending..." : "Send to segment"}
          </button>
        </div>
      ) : <div className="text-xs text-white/35">Final send appears after review.</div>}
      {notice ? <div className="text-sm text-emerald-200">{notice}</div> : null}
      {error ? <div className="text-sm text-red-200">{error}</div> : null}
    </div>
  );
}
