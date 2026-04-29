"use client";

import { useEffect, useState } from "react";

const CAMPAIGN_SEGMENTS = [
  "trial_never_ran",
  "imported_not_completed",
  "failed_twice",
  "near_quota",
  "heavy_users",
  "love_signals",
  "canceled_users",
] as const;

type CampaignSegmentKey = (typeof CAMPAIGN_SEGMENTS)[number];

function campaignSegmentLabel(key: string) {
  const labels: Record<string, string> = {
    trial_never_ran: "Trial never ran",
    imported_not_completed: "Imported, no complete",
    failed_twice: "Failed twice",
    near_quota: "Near quota",
    heavy_users: "Heavy users",
    love_signals: "Love signals",
    canceled_users: "Canceled users",
  };
  return labels[key] || key.replace(/_/g, " ");
}

type Preview = {
  total: number;
  sendable: number;
  suppressed: number;
  invalid: number;
  recipients: Array<{ email: string; status: string; plan?: string | null; subscription_status?: string | null }>;
};

export function EmailCampaignCreateForm() {
  const [segmentKey, setSegmentKey] = useState<CampaignSegmentKey>("trial_never_ran");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setError(null);
      const res = await fetch(`/api/admin/email/preview?segment_key=${encodeURIComponent(segmentKey)}`);
      const data = (await res.json().catch(() => ({}))) as Preview & { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Unable to load preview.");
        setPreview(null);
        return;
      }
      setPreview(data);
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [segmentKey]);

  async function createCampaign() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        subject,
        body_markdown: body,
        segment_key: segmentKey,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !data.id) {
      setError(data.error || "Unable to create campaign.");
      return;
    }
    window.location.href = `/admin/email/${data.id}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="card p-5">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm text-white/70">
            Segment
            <select className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" value={segmentKey} onChange={(event) => setSegmentKey(event.target.value as CampaignSegmentKey)}>
              {CAMPAIGN_SEGMENTS.map((segment) => <option key={segment} value={segment}>{campaignSegmentLabel(segment)}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Campaign name
            <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" value={name} onChange={(event) => setName(event.target.value)} placeholder="Trial users first-run help" />
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Subject
            <input className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Want help creating your first CutSwitch edit?" />
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Body markdown
            <textarea className="min-h-56 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-brand/60" value={body} onChange={(event) => setBody(event.target.value)} placeholder={"Short, useful, and specific. Include why you're writing and one clear next step."} />
          </label>
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            Final send requires review plus typing SEND on the campaign detail page. Suppressed and invalid recipients are skipped.
          </div>
          <button className="btn btn-primary w-fit" type="button" onClick={createCampaign} disabled={busy}>{busy ? "Creating..." : "Create draft campaign"}</button>
          {error ? <div className="text-sm text-red-200">{error}</div> : null}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-semibold text-white">Dry-run preview</h3>
        <p className="mt-1 text-sm text-white/55">No emails are sent here. First 20 recipients only.</p>
        {preview ? (
          <div className="mt-5 grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <PreviewStat label="Total" value={preview.total} />
              <PreviewStat label="Sendable" value={preview.sendable} />
              <PreviewStat label="Suppressed" value={preview.suppressed} />
              <PreviewStat label="Invalid" value={preview.invalid} />
            </div>
            <div className="grid gap-2">
              {preview.recipients.map((recipient) => (
                <div key={`${recipient.email}:${recipient.status}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="truncate text-sm font-medium text-white">{recipient.email || "-"}</div>
                  <div className="mt-1 text-xs text-white/45">{recipient.status} · {(recipient.plan || "no plan").replace(/_/g, " ")} · {recipient.subscription_status || "no status"}</div>
                </div>
              ))}
              {preview.recipients.length === 0 ? <div className="text-sm text-white/45">No recipients match this segment.</div> : null}
            </div>
          </div>
        ) : <div className="mt-5 text-sm text-white/45">Loading preview...</div>}
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value.toLocaleString()}</div>
    </div>
  );
}
