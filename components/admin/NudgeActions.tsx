"use client";

import { useState } from "react";

export function NudgeActions({ id, subject, message, status, userEmail }: { id: string; subject: string; message: string; status: string; userEmail: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(status: "reviewed" | "suppressed") {
    setBusy(status);
    setError(null);
    const res = await fetch(`/api/admin/nudges/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Unable to update nudge.");
      return;
    }
    window.location.reload();
  }

  async function send() {
    if (!userEmail) {
      setError("Missing user email.");
      return;
    }
    const confirmed = window.confirm(`Send this email to ${userEmail}?`);
    if (!confirmed) return;

    setBusy("send");
    setError(null);
    const res = await fetch(`/api/admin/nudges/${id}/send`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Unable to send nudge.");
      return;
    }
    window.location.reload();
  }

  async function copyMessage() {
    setCopied(false);
    setError(null);
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${message}`);
      setCopied(true);
    } catch {
      setError("Unable to copy message.");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5" onClick={() => update("reviewed")} disabled={busy !== null}>
            {busy === "reviewed" ? "Saving…" : "Mark reviewed"}
          </button>
        ) : null}
        {status !== "suppressed" && status !== "sent" ? (
          <button type="button" className="rounded-xl border border-amber-300/20 px-3 py-2 text-xs text-amber-100 hover:bg-amber-300/10" onClick={() => update("suppressed")} disabled={busy !== null}>
            {busy === "suppressed" ? "Saving…" : "Suppress"}
          </button>
        ) : null}
        <button type="button" className="rounded-xl border border-brand/30 px-3 py-2 text-xs text-brand-highlight hover:bg-brand/10" onClick={copyMessage}>Copy message</button>
        {status === "reviewed" ? (
          <button type="button" className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-400/15" onClick={send} disabled={busy !== null || !userEmail}>
            {busy === "send" ? "Sending…" : "Send one-off"}
          </button>
        ) : null}
      </div>
      {status !== "reviewed" ? <div className="text-xs text-white/35">Send appears after review.</div> : null}
      {copied ? <span className="text-xs text-emerald-200">Copied</span> : null}
      {error ? <span className="text-xs text-red-200">{error}</span> : null}
    </div>
  );
}
