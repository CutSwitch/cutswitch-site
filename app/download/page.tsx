import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Download",
  description: "Download CutSwitch for macOS and view release notes.",
};

export default function DownloadPage() {
  const url = process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC;

  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Download"
        title="CutSwitch for macOS"
        subtitle="Fast install, clean UI, and a workflow that feels like you leveled up your hands."
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
            <Link className="btn btn-secondary" href="/changelog">
              Release notes
            </Link>
          </div>

          <div className="mt-6 gradient-line" />

          <div className="mt-6 grid gap-2 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <span className="text-white/55">Platform</span>
              <span>macOS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">License</span>
              <span>2 Macs per license</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/55">Trial</span>
              <span>7 days (subscriptions)</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Next steps</div>
          <ol className="mt-3 space-y-2 text-sm text-white/70">
            <li>1) Install CutSwitch</li>
            <li>2) Open the app and start your trial or enter your license key</li>
            <li>
              3) If you purchased, check your email for your license and device instructions (or contact Support)
            </li>
          </ol>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-secondary" href="/pricing">
              View pricing
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
