"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ConsentState = {
  necessary: true;
  preferences: boolean;
  affiliateMarketing: boolean;
  analytics: boolean;
  gpc: boolean;
  updatedAt: string;
};

type DraftConsent = Pick<ConsentState, "preferences" | "affiliateMarketing" | "analytics">;

const STORAGE_KEY = "cutswitch-cookie-consent-v1";

declare global {
  interface Window {
    _rwq?: string;
    rewardful?: (...args: any[]) => void;
  }

  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

function hasGpcEnabled() {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}

function defaultConsent(gpc: boolean): ConsentState {
  return {
    necessary: true,
    preferences: true,
    affiliateMarketing: false,
    analytics: false,
    gpc,
    updatedAt: new Date().toISOString(),
  };
}

function readStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.necessary !== true || typeof parsed.updatedAt !== "string") return null;
    return {
      necessary: true,
      preferences: parsed.preferences === true,
      affiliateMarketing: parsed.affiliateMarketing === true,
      analytics: parsed.analytics === true,
      gpc: parsed.gpc === true,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function loadRewardful(apiKey: string) {
  if (typeof window === "undefined" || document.getElementById("rewardful-script")) return;

  window._rwq = "rewardful";
  window.rewardful =
    window.rewardful ||
    function rewardfulQueue(...args: any[]) {
      const queued = window.rewardful as ((...queuedArgs: any[]) => void) & { q?: any[][] };
      (queued.q = queued.q || []).push(args);
    };

  const script = document.createElement("script");
  script.id = "rewardful-script";
  script.async = true;
  script.src = "https://r.wdfl.co/rw.js";
  script.dataset.rewardful = apiKey;
  document.head.appendChild(script);
}

export function CookieConsent({ rewardfulApiKey }: { rewardfulApiKey: string | null }) {
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [draft, setDraft] = useState<DraftConsent>({
    preferences: true,
    affiliateMarketing: false,
    analytics: false,
  });

  useEffect(() => {
    const gpc = hasGpcEnabled();
    const stored = readStoredConsent();
    const initial = stored || defaultConsent(gpc);
    setConsent(initial);
    setDraft({
      preferences: initial.preferences,
      affiliateMarketing: initial.affiliateMarketing,
      analytics: initial.analytics,
    });
    setIsVisible(!stored);
    setIsReady(true);

    function openSettings() {
      const latest = readStoredConsent() || initial;
      setConsent(latest);
      setDraft({
        preferences: latest.preferences,
        affiliateMarketing: latest.affiliateMarketing,
        analytics: latest.analytics,
      });
      setIsManaging(true);
      setIsVisible(true);
    }

    window.addEventListener("cutswitch:open-cookie-settings", openSettings);
    return () => window.removeEventListener("cutswitch:open-cookie-settings", openSettings);
  }, []);

  useEffect(() => {
    if (consent?.affiliateMarketing && rewardfulApiKey) {
      loadRewardful(rewardfulApiKey);
    }
  }, [consent?.affiliateMarketing, rewardfulApiKey]);

  function save(next: DraftConsent) {
    const saved: ConsentState = {
      necessary: true,
      ...next,
      gpc: hasGpcEnabled(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    setConsent(saved);
    setDraft(next);
    setIsVisible(false);
    setIsManaging(false);
    window.dispatchEvent(new CustomEvent("cutswitch:cookie-consent-changed", { detail: saved }));
  }

  if (!isReady || !isVisible) return null;

  const gpcActive = consent?.gpc || hasGpcEnabled();

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/12 bg-[#111426]/95 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl theme-light:border-black/10 theme-light:bg-white/95 theme-light:text-slate-950">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <div className="text-sm font-semibold">Cookie choices</div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/65 theme-light:text-slate-600">
              We use necessary storage for login, checkout, security, and preferences. Affiliate tracking such as
              Rewardful only loads if you allow nonessential marketing cookies.
            </p>
            {gpcActive ? (
              <p className="mt-2 text-xs text-amber-200 theme-light:text-amber-700">
                Global Privacy Control is detected, so nonessential tracking stays off unless you opt in.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
            <button className="btn btn-primary whitespace-nowrap" type="button" onClick={() => save({ preferences: true, affiliateMarketing: true, analytics: true })}>
              Accept all
            </button>
            <button
              className="btn btn-ghost whitespace-nowrap"
              type="button"
              onClick={() => save({ preferences: true, affiliateMarketing: false, analytics: false })}
            >
              Reject nonessential
            </button>
            <button className="btn btn-ghost whitespace-nowrap" type="button" onClick={() => setIsManaging((value) => !value)}>
              Manage choices
            </button>
          </div>
        </div>

        {isManaging ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 theme-light:border-black/10 theme-light:bg-slate-50">
            <ConsentRow
              title="Necessary"
              description="Required for site security, account sessions, checkout, support forms, and legal compliance."
              checked
              disabled
            />
            <ConsentRow
              title="Preferences"
              description="Remembers choices such as theme and this cookie setting."
              checked={draft.preferences}
              onChange={(checked) => setDraft((prev) => ({ ...prev, preferences: checked }))}
            />
            <ConsentRow
              title="Affiliate / marketing"
              description="Allows Rewardful attribution and similar nonessential marketing measurement."
              checked={draft.affiliateMarketing}
              onChange={(checked) => setDraft((prev) => ({ ...prev, affiliateMarketing: checked }))}
            />
            <ConsentRow
              title="Analytics"
              description="Reserved for future privacy-conscious analytics. Off unless you enable it."
              checked={draft.analytics}
              onChange={(checked) => setDraft((prev) => ({ ...prev, analytics: checked }))}
            />
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button className="btn btn-primary" type="button" onClick={() => save(draft)}>
                Save choices
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setIsManaging(false)}>
                Back
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-3",
        "theme-light:border-black/10 theme-light:bg-white",
        disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-white/90 theme-light:text-slate-950">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-white/55 theme-light:text-slate-600">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 rounded border-white/20 bg-white/10 accent-[#655DFF]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
    </label>
  );
}
