"use client";

import { useState } from "react";

import type { FeedbackRow } from "@/lib/admin/data";

const PRODUCT_AREAS = ["", "onboarding", "import", "transcription_or_analysis", "run", "export", "billing", "account", "website", "performance", "unclear"];
const SEVERITIES = ["low", "normal", "high", "urgent"];
const PRIORITIES = ["", "low", "normal", "high", "urgent"];
const STATUSES = ["new", "reviewed", "planned", "shipped", "declined", "branch_ready", "resolved", "ignored"];
const REPRO = ["", "unknown", "low", "medium", "high"];

export function FeedbackIntelligenceEditor({ item }: { item: FeedbackRow }) {
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setSaved(false);
    setError(null);

    const res = await fetch(`/api/admin/feedback/${item.id}/intelligence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        summary: formData.get("summary"),
        product_area: formData.get("product_area"),
        severity: formData.get("severity"),
        admin_priority: formData.get("admin_priority"),
        status: formData.get("status"),
        codex_ready: formData.get("codex_ready") === "on",
        suggested_owner: formData.get("suggested_owner"),
        suggested_branch_name: formData.get("suggested_branch_name"),
        reproduction_likelihood: formData.get("reproduction_likelihood"),
        recommended_next_action: formData.get("recommended_next_action"),
        customer_impact: formData.get("customer_impact"),
      }),
    });

    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Unable to save feedback intelligence.");
      return;
    }
    setSaved(true);
  }

  return (
    <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.16em] text-white/45">Edit intelligence</summary>
      <form action={onSubmit} className="mt-4 grid gap-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Title" name="title" defaultValue={item.title || item.ai_title || ""} />
          <Field label="Suggested branch" name="suggested_branch_name" defaultValue={item.suggested_branch_name || item.ai_suggested_branch_name || ""} />
          <Select label="Product area" name="product_area" defaultValue={item.product_area || item.ai_category || ""} values={PRODUCT_AREAS} />
          <Select label="Severity" name="severity" defaultValue={item.severity || "normal"} values={SEVERITIES} />
          <Select label="Admin priority" name="admin_priority" defaultValue={item.admin_priority || ""} values={PRIORITIES} />
          <Select label="Status" name="status" defaultValue={item.status || "new"} values={STATUSES} />
          <Select label="Repro likelihood" name="reproduction_likelihood" defaultValue={item.reproduction_likelihood || ""} values={REPRO} />
          <Field label="Suggested owner" name="suggested_owner" defaultValue={item.suggested_owner || ""} />
        </div>
        <TextArea label="Summary" name="summary" defaultValue={item.summary || item.ai_summary || ""} />
        <TextArea label="Recommended next action" name="recommended_next_action" defaultValue={item.recommended_next_action || item.ai_recommended_next_action || ""} />
        <TextArea label="Customer impact" name="customer_impact" defaultValue={item.customer_impact || ""} />
        <label className="inline-flex items-center gap-2 text-sm text-white/70">
          <input name="codex_ready" type="checkbox" defaultChecked={item.codex_ready === true || item.ai_should_be_codex_task === true || item.status === "branch_ready"} />
          Codex-ready / branch-ready
        </label>
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save intelligence"}</button>
          {saved ? <span className="text-xs text-emerald-200">Saved</span> : null}
          {error ? <span className="text-xs text-red-200">{error}</span> : null}
        </div>
      </form>
    </details>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      <span>{label}</span>
      <input name={name} defaultValue={defaultValue} className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-brand/60" />
    </label>
  );
}

function Select({ label, name, defaultValue, values }: { label: string; name: string; defaultValue: string; values: string[] }) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-brand/60">
        {values.map((value) => <option key={value || "none"} value={value}>{value ? value.replace(/_/g, " ") : "Unset"}</option>)}
      </select>
    </label>
  );
}

function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-xs text-white/45">
      <span>{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={3} className="rounded-xl border border-white/10 bg-[#0E1020] px-3 py-2 text-sm leading-6 text-white outline-none focus:ring-2 focus:ring-brand/60" />
    </label>
  );
}
