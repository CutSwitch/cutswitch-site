import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/segments", label: "Segments" },
  { href: "/admin/nudges", label: "Nudges" },
  { href: "/admin/email", label: "Email" },
  { href: "/admin/lifecycle", label: "Lifecycle" },
  { href: "/admin/feedback", label: "Feedback" },
  { href: "/admin/feedback/branch-ready", label: "Branch-ready" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="container-edge py-10 sm:py-14">
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-end sm:p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-brand-highlight/80">Admin</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">CutSwitch control tower</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Founder/operator signals for users, editing time, feedback, and stuck workflows.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 transition hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
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

export function StatCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail?: string; tone?: "default" | "warning" | "danger" | "good" | "brand" }) {
  const toneClass = {
    default: "border-white/10 bg-white/5",
    warning: "border-amber-300/25 bg-amber-300/10",
    danger: "border-red-300/25 bg-red-400/10",
    good: "border-emerald-300/25 bg-emerald-400/10",
    brand: "border-brand/35 bg-brand/15",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-5", toneClass)}>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-5 text-white/55">{detail}</div> : null}
    </div>
  );
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
