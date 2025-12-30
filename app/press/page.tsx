import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Press",
  description: "CutSwitch press kit and media resources.",
};

export default function PressPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Press"
        title="Media kit"
        subtitle="Placeholder. Add logos, screenshots, and a one-paragraph product blurb for press."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Product blurb</div>
          <p className="mt-2 text-sm text-white/65">
            CutSwitch is a premium macOS utility that accelerates repetitive editorial actions and keeps editors in
            flow. Built for speed, consistency, and a minimal dark interface.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Resources</div>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>Logo: /public/logo.svg</li>
            <li>Screenshots: /public/images/screen1.png ...</li>
            <li>Demo video: /public/videos/demo.mp4</li>
          </ul>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link className="btn btn-secondary" href="/download">
              Download
            </Link>
            <Link className="btn btn-ghost" href="/support">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
