import Link from "next/link";

export function FinalCTA() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-80" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Cut less. Create more.
          </div>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
            Download CutSwitch, start your trial, and feel the difference inside your own workflow. When it clicks,
            upgrade in a couple of taps.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-primary" href="/pricing">
            Get CutSwitch
            <span className="text-white/80">→</span>
          </Link>
          <Link className="btn btn-secondary" href="/download">
            Download for macOS
          </Link>
        </div>
      </div>
    </div>
  );
}
