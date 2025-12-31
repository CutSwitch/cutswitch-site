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
        subtitle="Logos, blurbs, and links you can drop into a review, newsletter, or YouTube description."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm font-semibold text-white/90">Product blurb</div>
          <p className="mt-2 text-sm text-white/65">
            CutSwitch is a macOS app for Final Cut Pro editors that automatically switches multicam angles based on
            who’s speaking. Export an XML, drop one audio file per speaker, map speakers to cameras, choose a rhythm,
            and CutSwitch exports a new .fcpxmld bundle you can import back into Final Cut and refine.
          </p>
          <div className="mt-4 text-sm text-white/70">
            <div className="text-white/55">One-liner</div>
            <div className="mt-1">Voice-driven multicam edits for Final Cut Pro.</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold text-white/90">Resources</div>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>Logo: /public/logo.svg</li>
            <li>Wordmark: /public/wordmark.svg</li>
            <li>Icon mark: /public/logo-mark.svg</li>
            <li>Demo video: /public/videos/demo.mp4</li>
            <li>
              Need screenshots? Email{" "}
              <span className="font-mono text-white/80">support@cutswitch.com</span>.
            </li>
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
