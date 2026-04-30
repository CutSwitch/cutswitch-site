"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", match: (path: string) => path === "/admin" },
  { href: "/admin/users", label: "Users", match: (path: string) => path.startsWith("/admin/users") },
  { href: "/admin/jobs", label: "Jobs", match: (path: string) => path.startsWith("/admin/jobs") },
  { href: "/admin/segments", label: "Segments", match: (path: string) => path.startsWith("/admin/segments") },
  { href: "/admin/nudges", label: "Nudges", match: (path: string) => path.startsWith("/admin/nudges") },
  { href: "/admin/email", label: "Email", match: (path: string) => path.startsWith("/admin/email") },
  { href: "/admin/lifecycle", label: "Lifecycle", match: (path: string) => path.startsWith("/admin/lifecycle") },
  { href: "/admin/feedback", label: "Feedback", match: (path: string) => path.startsWith("/admin/feedback") },
];

const COMMANDS = [
  { label: "Search users by email", hint: "Opens filtered Users", href: (q: string) => `/admin/users?q=${encodeURIComponent(q)}` },
  { label: "Search jobs", hint: "Email, error code, app version, job ID clue", href: (q: string) => `/admin/jobs?q=${encodeURIComponent(q)}&range=all` },
  { label: "Search feedback", hint: "Message, user, screen", href: (q: string) => `/admin/feedback?q=${encodeURIComponent(q)}` },
  { label: "Failed jobs", hint: "Action queue", href: () => "/admin/jobs?status=failed&range=all" },
  { label: "Trial inactivity", hint: "Users to help first", href: () => "/admin/segments/trial-never-ran" },
  { label: "Branch-ready feedback", hint: "Codex task candidates", href: () => "/admin/feedback?status=branch_ready" },
  { label: "Praise candidates", hint: "Love signals", href: () => "/admin/segments/love-signals" },
];

export function AdminShell({ children, newFeedbackCount = 0 }: { children: React.ReactNode; newFeedbackCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q)).concat(
      COMMANDS.filter((item) => !`${item.label} ${item.hint}`.toLowerCase().includes(q)).slice(0, 2)
    );
  }, [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section data-admin-shell className="container-edge py-0 sm:py-0">
      <style jsx global>{`
        body:has([data-admin-shell]) footer {
          display: none;
        }
        body:has([data-admin-shell]) main {
          padding-top: 0;
          padding-bottom: 0;
        }
      `}</style>
      <div className="grid min-h-[calc(100vh-84px)] gap-6 py-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-[#0D1020]/90 p-4 shadow-soft backdrop-blur">
            <div className="px-2">
              <div className="text-xs uppercase tracking-[0.24em] text-brand-highlight/80">Admin</div>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">Control tower</h1>
              <p className="mt-2 text-xs leading-5 text-white/50">Who is doing well, who is stuck, and what needs action today.</p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/60 transition hover:bg-white/[0.07] hover:text-white"
            >
              <span>Search admin...</span>
              <kbd className="rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-white/45">⌘K</kbd>
            </button>

            <nav className="mt-5 grid gap-1">
              {NAV.map((item) => {
                const active = item.match(pathname || "");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm transition",
                      active
                        ? "border border-brand/35 bg-brand/20 text-white shadow-glow"
                        : "border border-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      {item.href === "/admin/feedback" && newFeedbackCount > 0 ? (
                        <span className="rounded-full border border-brand/35 bg-brand/25 px-2 py-0.5 text-[10px] font-semibold text-brand-highlight">
                          {newFeedbackCount > 99 ? "99+" : newFeedbackCount}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-white/45">
              <div className="font-medium text-white/70">Admin footer</div>
              <div>Version 1.0 · no-store</div>
              <Link href="/support" className="text-brand-highlight hover:text-white">Quick help</Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-white/10 bg-[#080A16]/82 px-4 py-4 backdrop-blur-xl sm:rounded-b-3xl lg:top-0">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/35">CutSwitch Admin</div>
                <p className="mt-1 text-sm text-white/58">Fast read first. Drill down second. No dashboard confetti.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/jobs?status=failed&range=all" className="btn btn-secondary">Failed jobs</Link>
                <Link href="/admin/feedback?status=new" className="btn btn-secondary">
                  New feedback{newFeedbackCount > 0 ? ` (${newFeedbackCount})` : ""}
                </Link>
                <Link href="/admin/feedback?status=branch_ready" className="btn btn-secondary">Branch-ready</Link>
                <Link href="/admin/segments/love-signals" className="btn btn-secondary">Praise</Link>
              </div>
            </div>
          </div>
          {children}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
          <div className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0D1020] shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
            <div className="border-b border-white/10 p-4">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email, user ID, job clue, or feedback keyword..."
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-white/35"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.map((item) => {
                const href = item.href(query.trim());
                return (
                  <Link
                    key={`${item.label}-${href}`}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 transition hover:bg-white/[0.06]"
                  >
                    <div className="font-medium text-white">{item.label}</div>
                    <div className="mt-1 text-sm text-white/45">{item.hint}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AdminForbidden() {
  return (
    <main className="container-edge py-16 sm:py-24">
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="text-xs uppercase tracking-[0.24em] text-red-200/80">403</div>
        <h1 className="mt-3 text-3xl font-semibold text-white">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          This area is limited to the CutSwitch admin allowlist. If this should be you, update `ADMIN_EMAILS`.
        </p>
      </div>
    </main>
  );
}

export function StatCard({ label, value, detail, tone = "default", href }: { label: string; value: string; detail?: string; tone?: "default" | "warning" | "danger" | "good" | "brand"; href?: string }) {
  const toneClass = {
    default: "border-white/10 bg-white/5",
    warning: "border-amber-300/25 bg-amber-300/10",
    danger: "border-red-300/25 bg-red-400/10",
    good: "border-emerald-300/25 bg-emerald-400/10",
    brand: "border-brand/35 bg-brand/15",
  }[tone];

  const content = (
    <>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-5 text-white/55">{detail}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link className={cn("block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-brand/45 hover:bg-brand/10", toneClass)} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={cn("rounded-2xl border p-5", toneClass)}>{content}</div>;
}

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" | "danger" | "good" | "brand" }) {
  const toneClass = {
    default: "border-white/10 bg-white/5 text-white/70",
    warning: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    danger: "border-red-300/25 bg-red-400/10 text-red-100",
    good: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
    brand: "border-brand/35 bg-brand/15 text-brand-highlight",
  }[tone];

  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}
