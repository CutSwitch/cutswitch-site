import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Download",
  description: "Download CutSwitch for macOS and view release notes.",
};

export default function DownloadPage() {
  const url = process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC;

  function StepCard({
    title,
    caption,
    icon,
  }: {
    title: string;
    caption: string;
    icon: ReactNode;
  }) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-4">
        <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-30" />
        <div className="relative flex gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <span className="text-brand">{icon}</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">{title}</div>
            <p className="mt-1 text-sm leading-relaxed text-white/65">{caption}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Download"
        title="CutSwitch for macOS"
        subtitle="Download the latest beta build. CutSwitch runs locally on your Mac and exports a new Final Cut timeline you can refine."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Installer</div>
          <p className="mt-2 text-sm text-white/65">
            Download the latest build. If the button is disabled, set{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_DOWNLOAD_URL_MAC</code> in your env.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {url ? (
              <a className="btn btn-primary" href={url}>
                Download for macOS <span className="text-white/80">→</span>
              </a>
            ) : (
              <button className="btn btn-primary opacity-60 cursor-not-allowed" disabled>
                Download for macOS
              </button>
            )}
            </div>

          <div className="mt-6 gradient-line" />

          <div className="mt-6 grid gap-2 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span className="text-white/55">Platform</span>
              <span>macOS (universal)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">Chips</span>
              <span>Apple Silicon + Intel</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">Input</span>
              <span>.fcpxml / .fcpxmld</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">Output</span>
              <span>.fcpxmld bundle</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">Privacy</span>
              <span>Local-first (no uploads)</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Next steps</div>
          <p className="mt-2 text-sm text-white/65">
            Four moves. No scrolling brain fatigue. Get from install → first cut as fast as possible.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StepCard
              title="Install CutSwitch"
              caption="Drag to Applications. Launch it once so macOS trusts it."
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
            <StepCard
              title="Export a multicam XML"
              caption="In Final Cut Pro, export a .fcpxml/.fcpxmld from a project with a real multicam clip."
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="M7 3h7l3 3v15H7V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M9 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
            <StepCard
              title="Add audio + map speakers"
              caption="Drop one audio file per speaker, map each speaker to a camera angle, then pick your rhythm."
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3z" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
            <StepCard
              title="Run + import back to FCP"
              caption="Generate the new .fcpxmld, import into Final Cut, and polish the cut like normal."
              icon={
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                  <path d="M5 5h14v14H5V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                </svg>
              }
            />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-secondary" href="/pricing">
              View pricing
            </Link>
            <Link className="btn btn-ghost" href="/demo">
              Watch the demo
            </Link>
            <Link className="btn btn-ghost" href="/support">
              Get help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
