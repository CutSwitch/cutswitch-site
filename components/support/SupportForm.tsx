"use client";

import { useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

// Some browsers render <select> option menus with a light theme even on dark sites.
// Since our <select> uses light text, native option lists can end up as white-on-white
// (invisible). Force a readable option palette.
const SELECT_OPTION_STYLE: CSSProperties = {
  color: "#0e101f",
  backgroundColor: "#ffffff",
};

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_SCREENSHOT_COUNT = 5;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function SupportForm() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [cutPlan, setCutPlan] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const cutPlanRef = useRef<HTMLInputElement>(null);
  const screenshotsRef = useRef<HTMLInputElement>(null);

  function resetFileError() {
    setFileError(null);
  }

  function handleCutPlanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setCutPlan(null);
      return;
    }

    const isJson =
      file.type === "application/json" || file.name.toLowerCase().endsWith(".json");
    if (!isJson) {
      setFileError("Cut Plan must be a .json file.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_JSON_BYTES) {
      setFileError("Cut Plan JSON must be 5 MB or less.");
      e.target.value = "";
      return;
    }

    resetFileError();
    setCutPlan(file);
  }

  function handleScreenshotsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const next = [...screenshots];
    let hasError = false;
    for (const file of files) {
      if (next.length >= MAX_SCREENSHOT_COUNT) {
        setFileError(`Up to ${MAX_SCREENSHOT_COUNT} screenshots are allowed.`);
        hasError = true;
        break;
      }

      const isAllowedType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
      if (!isAllowedType) {
        setFileError("Screenshots must be PNG, JPG, or WEBP.");
        hasError = true;
        continue;
      }

      if (file.size > MAX_SCREENSHOT_BYTES) {
        setFileError(`"${file.name}" is larger than 5 MB.`);
        hasError = true;
        continue;
      }

      next.push(file);
    }

    if (!hasError) {
      resetFileError();
    }
    setScreenshots(next);
    if (screenshotsRef.current) {
      screenshotsRef.current.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (fileError) {
      setState({ status: "error", message: fileError });
      return;
    }
    setState({ status: "submitting" });

    const form = new FormData(e.currentTarget);
    form.delete("cutPlan");
    form.delete("screenshots");
    if (cutPlan) form.append("cutPlan", cutPlan, cutPlan.name);
    screenshots.forEach((file) => form.append("screenshots", file, file.name));

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        body: form,
      });

      const raw = await res.text();
      let data: { ok?: boolean; error?: string; message?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "Something went wrong.");

      (e.target as HTMLFormElement).reset();
      setCutPlan(null);
      setScreenshots([]);
      if (cutPlanRef.current) cutPlanRef.current.value = "";
      if (screenshotsRef.current) screenshotsRef.current.value = "";
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
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 [color-scheme:light]",
              "focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
            defaultValue="support"
          >
            <option style={SELECT_OPTION_STYLE} value="support">
              Support
            </option>
            <option style={SELECT_OPTION_STYLE} value="feedback">
              Feedback
            </option>
            <option style={SELECT_OPTION_STYLE} value="billing">
              Billing
            </option>
            <option style={SELECT_OPTION_STYLE} value="affiliates">
              Affiliates
            </option>
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

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <div className="text-sm font-semibold text-white/90">Attachments (optional)</div>
          <p className="mt-1 text-xs text-white/60">
            Cut Plan JSON helps us reproduce. Screenshots help us diagnose fast.
          </p>
        </div>

        <label className="grid gap-2 text-sm">
          <span className="text-white/75">Cut Plan JSON (.json)</span>
          <input
            ref={cutPlanRef}
            type="file"
            name="cutPlan"
            accept=".json,application/json"
            onChange={handleCutPlanChange}
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white/80",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
          />
        </label>

        {cutPlan ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
              {cutPlan.name} · {formatBytes(cutPlan.size)}
            </span>
            <button
              type="button"
              className="text-white/50 hover:text-white/80"
              onClick={() => {
                setCutPlan(null);
                resetFileError();
                if (cutPlanRef.current) cutPlanRef.current.value = "";
              }}
            >
              Remove
            </button>
          </div>
        ) : null}

        <label className="grid gap-2 text-sm">
          <span className="text-white/75">
            Screenshots (PNG, JPG, WEBP — up to {MAX_SCREENSHOT_COUNT})
          </span>
          <input
            ref={screenshotsRef}
            type="file"
            name="screenshots"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleScreenshotsChange}
            className={cn(
              "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90",
              "file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white/80",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-brand/50"
            )}
          />
        </label>

        {screenshots.length ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            {screenshots.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1"
              >
                {file.name} · {formatBytes(file.size)}
                <button
                  type="button"
                  className="text-white/50 hover:text-white/80"
                  onClick={() => {
                    setScreenshots((prev) => prev.filter((_, i) => i !== index));
                    resetFileError();
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {fileError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {fileError}
          </div>
        ) : null}
      </div>

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
        Note: we do not offer refunds, but we will help you troubleshoot fast.
      </p>
    </form>
  );
}
