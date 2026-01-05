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
    mediaSrc,
    mediaAlt,
  }: {
    title: string;
    caption: string;
    icon: ReactNode;
    mediaSrc: string;
    mediaAlt: string;
  }) {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-[0_26px_120px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-25" />
        <div className="relative">
          <div className="relative aspect-[16/9] overflow-hidden bg-black/25">
            <img
              src={mediaSrc}
              alt={mediaAlt}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(101,93,255,0.25),transparent_60%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(180deg,rgba(0,0,0,0.25),transparent_35%,rgba(0,0,0,0.35))]" />
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <span className="text-brand">{icon}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{caption}</p>
              </div>
            </div>
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
        subtitle="Download the latest build. CutSwitch runs locally on your Mac and exports a new Final Cut timeline you can refine."
      />

      {/* Stack the download installer and the “Next steps” so the setup reads top-to-bottom. */}
      <div className="mt-8 grid gap-6">
        <div className="card p-4 sm:p-6">
          <div className="text-sm font-semibold text-white/90">Installer</div>
          <p className="mt-2 text-sm text-white/65">
            Download the latest build.
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

        <div className="card p-4 sm:p-6">
          <div className="text-sm font-semibold text-white/90">Next steps</div>
          <p className="mt-2 text-sm text-white/65">
            Four moves. No scrolling brain fatigue. Get from install → first cut as fast as possible.
          </p>

          <div className="mt-6 grid gap-5">
            <StepCard
              title="Install CutSwitch"
              caption="Drag to Applications. Launch it once so macOS trusts it."
              mediaSrc="/illust/download-steps/install.gif"
              mediaAlt="Install CutSwitch preview"
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
              mediaSrc="/illust/download-steps/export.gif"
              mediaAlt="Export a multicam XML preview"
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
              caption="Drop isolated, single-speaker audio files (one file per speaker) with minimal bleed/crosstalk, map each speaker to a camera angle, then pick your rhythm."
              mediaSrc="/illust/download-steps/add-audio.gif"
              mediaAlt="Add audio and map speakers preview"
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
              mediaSrc="/illust/download-steps/run-import.gif"
              mediaAlt="Run CutSwitch and import back into Final Cut preview"
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
