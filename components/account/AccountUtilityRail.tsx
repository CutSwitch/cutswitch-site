"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSupabaseSession } from "@/components/auth/useSupabaseSession";
import { cn } from "@/lib/utils";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type IconProps = {
  className?: string;
};

export function AccountUtilityRail() {
  const { session, user, loading } = useSupabaseSession();
  const [featureOpen, setFeatureOpen] = useState(false);
  const active = !loading && Boolean(user);

  useEffect(() => {
    document.body.classList.toggle("account-rail-active", active);
    return () => document.body.classList.remove("account-rail-active");
  }, [active]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!active) return;
      if (event.shiftKey && event.key.toLowerCase() === "f") {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
        event.preventDefault();
        setFeatureOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  if (loading || !user) return null;

  return (
    <>
      <aside
        className="account-utility-rail fixed bottom-6 left-4 top-24 z-40 hidden w-16 items-center justify-center rounded-[28px] border border-white/10 bg-black/55 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:flex"
        aria-label="Account shortcuts"
      >
        <nav className="grid gap-3">
          <RailLink href="/" label="Home" icon={<HomeIcon />} />
          <RailLink href="/support" label="Contact Support" icon={<SupportIcon />} />
          <RailButton label="Submit feature request" shortcut="⇧F" icon={<FeatureIcon />} onClick={() => setFeatureOpen(true)} />
          <RailLink href="/account" label="Account & Settings" icon={<AccountIcon />} featured />
        </nav>
      </aside>

      <FeatureRequestModal
        open={featureOpen}
        onClose={() => setFeatureOpen(false)}
        accessToken={session?.access_token ?? null}
      />
    </>
  );
}

function RailItemFrame({
  children,
  label,
  shortcut,
  featured,
}: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  featured?: boolean;
}) {
  return (
    <span className="group relative block">
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl border text-white/72 transition",
          "border-white/10 bg-white/[0.07] hover:-translate-y-0.5 hover:border-brand/45 hover:bg-brand/20 hover:text-white",
          "focus-within:-translate-y-0.5 focus-within:border-brand/45 focus-within:bg-brand/20 focus-within:text-white",
          featured ? "bg-[radial-gradient(circle_at_40%_25%,rgba(185,192,255,0.24),rgba(101,93,255,0.16),rgba(255,255,255,0.06))]" : ""
        )}
      >
        {children}
      </span>
      <span className="account-rail-label pointer-events-none absolute left-[62px] top-1/2 min-w-max -translate-y-1/2 scale-95 rounded-2xl border border-brand/30 bg-[#101323]/95 px-4 py-3 text-sm font-medium text-white opacity-0 shadow-soft transition group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100">
        <span className="account-rail-label-caret absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border-b border-l border-brand/30 bg-[#101323]" />
        <span className="relative flex items-center gap-3">
          {label}
          {shortcut ? <kbd className="min-w-9 rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-center text-xs text-white/70">{shortcut}</kbd> : null}
        </span>
      </span>
    </span>
  );
}

function RailLink({ href, label, icon, featured }: { href: string; label: string; icon: React.ReactNode; featured?: boolean }) {
  return (
    <RailItemFrame label={label} featured={featured}>
      <Link className="flex h-full w-full items-center justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/70" href={href} aria-label={label}>
        {icon}
      </Link>
    </RailItemFrame>
  );
}

function RailButton({ label, icon, shortcut, onClick }: { label: string; icon: React.ReactNode; shortcut?: string; onClick: () => void }) {
  return (
    <RailItemFrame label={label} shortcut={shortcut}>
      <button className="flex h-full w-full items-center justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand/70" type="button" onClick={onClick} aria-label={label}>
        {icon}
      </button>
    </RailItemFrame>
  );
}

function FeatureRequestModal({
  open,
  onClose,
  accessToken,
}: {
  open: boolean;
  onClose: () => void;
  accessToken: string | null;
}) {
  const router = useRouter();
  const titleId = useId();
  const [state, setState] = useState<FormState>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setState({ status: "idle" });
  }, [open]);

  if (!open) return null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      router.push("/login?next=/account");
      return;
    }

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const message = String(form.get("message") || "").trim();

    if (message.length < 3) {
      setState({ status: "error", message: "Tell us a little more first." });
      return;
    }

    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          type: "idea",
          title: title || "Feature request",
          message,
          screen: "Website / Account",
          current_page: window.location.pathname,
          app_area: "account",
          severity: "normal",
          context: {
            page: window.location.pathname,
            submitted_at: new Date().toISOString(),
            user_agent: navigator.userAgent.slice(0, 180),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Unable to send feature request.");

      (event.currentTarget as HTMLFormElement).reset();
      setState({ status: "success", message: "Thanks — feedback sent." });
    } catch {
      setState({ status: "error", message: "Unable to send feedback. Please try again." });
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={onClose}>
      <div className="mx-auto mt-24 max-w-lg rounded-3xl border border-white/10 bg-[#0E1020] p-6 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-brand-highlight/75">Feature request</div>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-white">What should CutSwitch do next?</h2>
            <p className="mt-2 text-sm leading-6 text-white/58">Send a quick idea straight into the admin feedback queue.</p>
          </div>
          <button className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70 hover:bg-white/10 hover:text-white" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="text-white/75">Short title optional</span>
            <input
              name="title"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand/60"
              placeholder="Example: Better export progress"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/75">Request</span>
            <textarea
              name="message"
              required
              rows={5}
              className="resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-brand/60"
              placeholder="What would make CutSwitch more useful?"
            />
          </label>

          {state.status === "success" ? <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{state.message}</div> : null}
          {state.status === "error" ? <div className="rounded-xl border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">{state.message}</div> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={state.status === "submitting"}>
              {state.status === "submitting" ? "Sending..." : "Submit feature request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={cn("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function SupportIcon({ className }: IconProps) {
  return (
    <svg className={cn("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 6.5A4.5 4.5 0 0 1 9.5 2h5A4.5 4.5 0 0 1 19 6.5v4A4.5 4.5 0 0 1 14.5 15H13l-4.5 4v-4A4.5 4.5 0 0 1 5 10.5v-4Z" fill="currentColor" opacity=".9" />
      <path d="M11.2 10.1c0-1.9 2.5-1.7 2.5-3.3 0-.8-.6-1.3-1.6-1.3-.9 0-1.6.4-2.1 1.1" stroke="#0E1020" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 12.4h.01" stroke="#0E1020" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function FeatureIcon({ className }: IconProps) {
  return (
    <svg className={cn("h-6 w-6", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.5 14.5c-1.4-1.1-2.3-2.8-2.3-4.8A5.8 5.8 0 0 1 12 4a5.8 5.8 0 0 1 5.8 5.7c0 2-.9 3.7-2.3 4.8-.8.6-1.2 1.2-1.3 2.2H9.8c-.1-1-.5-1.6-1.3-2.2Z" fill="currentColor" opacity=".9" />
      <path d="M12 7.5v4.2M9.9 9.6h4.2" stroke="#0E1020" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon({ className }: IconProps) {
  return (
    <svg className={cn("h-7 w-7", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 13.8 9l5.7-1.1-3.9 4.2 3.9 4.2-5.7-1.1L12 20.5l-1.8-5.3-5.7 1.1 3.9-4.2-3.9-4.2L10.2 9 12 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
