import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { VideoDemo } from "@/components/VideoDemo";
import { FeatureGrid } from "@/components/FeatureGrid";
import { TestimonialGrid } from "@/components/TestimonialGrid";
import { Faq } from "@/components/Faq";
import { PricingTable } from "@/components/pricing/PricingTable";
import { FinalCTA } from "@/components/FinalCTA";
import {
  IconCamera,
  IconExport,
  IconLock,
  IconScissors,
  IconUsers,
  IconWaveform,
} from "@/components/icons";

export const metadata: Metadata = {
  title: `${siteConfig.name} | ${siteConfig.tagline}`,
  description: siteConfig.description,
};

const features = [
  {
    icon: <IconWaveform className="h-5 w-5" />,
    mediaSrc: "/illust/voice.gif",
    mediaAlt: "Voice-driven multicam switching preview",
    title: "Voice-driven multicam switching",
    description:
      "Use isolated, single-speaker audio files (one file per speaker). Each file should primarily contain only that speaker’s voice with minimal bleed/crosstalk. CutSwitch switches angles based on who’s actually talking.",
  },
  {
    icon: <IconScissors className="h-5 w-5" />,
    mediaSrc: "/illust/cutstyle.gif",
    mediaAlt: "Cut style presets preview",
    title: "Cut styles that feel edited",
    description:
      "Choose Calm, Normal, or Punchy. Or turn on Custom to tune sensitivity, minimum shot length, and smoothing.",
  },
  {
    icon: <IconUsers className="h-5 w-5" />,
    mediaSrc: "/illust/group.gif",
    mediaAlt: "Group shots controls preview",
    title: "Tasteful group shots",
    description:
      "Set how often we cut to wide or two-shot. Presets for speed, Custom controls for pros who want the knobs.",
  },
  {
    icon: <IconCamera className="h-5 w-5" />,
    mediaSrc: "/illust/mapping.gif",
    mediaAlt: "Speaker to camera mapping preview",
    title: "Simple speaker-to-camera mapping",
    description:
      "Match each speaker to a camera angle. Multiple speakers can share one angle, so two-shots and shared cams just work.",
  },
  {
    icon: <IconExport className="h-5 w-5" />,
    mediaSrc: "/illust/export.gif",
    mediaAlt: "Export back into Final Cut preview",
    title: "Export right back into Final Cut",
    description:
      "CutSwitch outputs a fresh .fcpxmld bundle. Import it into Final Cut Pro and keep editing like normal.",
  },
  {
    icon: <IconLock className="h-5 w-5" />,
    mediaSrc: "/illust/local-first.gif",
    mediaAlt: "Local-first by design preview",
    title: "Local-first by design",
    description:
      "Runs on your Mac. Your media stays local. No uploads, no cloud processing, no weird surprises.",
  },
];

const testimonials = [
  {
    quote:
      "CutSwitch gets me 80% of the way there in minutes. I spend my time on story beats instead of babysitting the multicam.",
    name: "Early Editor",
    title: "Podcasts + Interviews",
  },
  {
    quote:
      "The rhythm presets are shockingly useful. Punchy nails the “yeah / mm-hmm” moments without me chasing angles all day.",
    name: "Post Producer",
    title: "YouTube / Social",
  },
  {
    quote:
      "Custom mode is the pro move. I can tune the sensitivity and minimum shot length and the edit suddenly feels intentional.",
    name: "Multicam Editor",
    title: "Longform Conversations",
  },
];

const faq = [
  {
    q: "Does CutSwitch upload my media?",
    a: "No. CutSwitch is local-first. It analyzes the audio files you provide and generates a Final Cut timeline bundle on your Mac.",
  },
  {
    q: "What do I need to run it?",
    a: "A Final Cut Pro multicam project export (.fcpxml or .fcpxmld) and isolated, single-speaker audio files (one file per speaker). Each file should primarily contain only that speaker’s voice with minimal bleed/crosstalk. Then map speakers to camera angles.",
  },
  {
    q: "Do the per-speaker audio files need to be clean?",
    a: "Yes. CutSwitch works best with isolated, single-speaker audio files (one file per speaker). Each file should primarily contain only that speaker’s voice with minimal bleed/crosstalk. More bleed usually means less accurate switching.",
  },
  {
    q: "What does it export?",
    a: "A new .fcpxmld bundle you can import directly into Final Cut Pro. The result is fully editable.",
  },
  {
    q: "Does Custom override presets?",
    a: "Yes. When Custom is on, your advanced settings become the source of truth. Clicking a preset re-seeds all custom values and keeps Custom on.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Monthly and yearly plans include a 7-day free trial (card required). You can cancel anytime in your account.",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="max-w-2xl">
              <div className="chip w-fit">macOS app · Final Cut Pro multicam</div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Auto-switch your multicam by who’s speaking.
              </h1>

              <p className="mt-6 text-base leading-relaxed text-white/70 sm:text-lg">
                Import a Final Cut XML, attach isolated, single-speaker audio files (one file per speaker) with minimal
                bleed/crosstalk, pick a rhythm. CutSwitch generates a clean, editable cut plan that follows the
                conversation.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/download" className="btn btn-primary">
                  Download
                  <span aria-hidden>→</span>
                </Link>
                <Link href="/demo" className="btn btn-secondary">
                  Watch the demo
                </Link>
                <Link href="/pricing" className="btn btn-ghost">
                  See pricing
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 sm:gap-3 text-xs text-white/70">
                <span className="chip">Apple Silicon + Intel</span>
                <span className="chip">Local-first</span>
                <span className="chip">Exports .fcpxmld</span>
                <span className="chip">Podcast / interview ready</span>
              </div>
            </div>

            <div className="lg:pt-2">
              <VideoDemo className="mx-auto w-full max-w-xl lg:max-w-none" />
              <p className="mt-3 text-xs text-white/60">
                Real pipeline, real output. Import the result into Final Cut Pro and refine.
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(101,93,255,0.25),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(101,93,255,0.10),transparent_60%)]" />
      </header>

      {/* Feature previews */}
      <section className="relative overflow-hidden bg-white/[0.02]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(101,93,255,0.18),transparent_55%),radial-gradient(circle_at_85%_65%,rgba(185,192,255,0.10),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 gradient-line opacity-80" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <FeatureGrid
            title="Built for conversation edits"
            subtitle="CutSwitch handles the switching so you can spend your energy on story, pacing, and punchlines."
            features={features}
          />
        </div>
      </section>

      {/* Social proof */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(101,93,255,0.14),transparent_55%),radial-gradient(circle_at_15%_70%,rgba(185,192,255,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 gradient-line opacity-80" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <TestimonialGrid
            title="What early editors are saying"
            subtitle="Early feedback has been consistent: less clicking, more control, better rhythm."
            items={testimonials}
          />
        </div>
      </section>

      {/* Affiliates */}
      <section className="relative overflow-hidden bg-white/[0.02] py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(101,93,255,0.16),transparent_60%),radial-gradient(circle_at_85%_20%,rgba(185,192,255,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 gradient-line opacity-80" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h3 className="text-xl font-semibold text-white">Affiliate program</h3>
                <p className="mt-2 text-sm text-white/70">
                  Recommend CutSwitch to editors and get paid. We provide tracking links, assets, and recurring commissions.
                </p>
                <div className="mt-5 flex gap-3">
                  <Link href="/affiliates" className="btn btn-secondary">
                    Become an affiliate
                  </Link>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <div className="aspect-[16/9]">
                  <img
                    src="/illust/affiliate-earnings.gif"
                    alt="Affiliate earnings preview"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(101,93,255,0.10),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(75,60,255,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 gradient-line opacity-80" />
        <PricingTable />
      </section>

      {/* FAQ */}
      <section className="relative overflow-hidden bg-white/[0.02] py-14 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(101,93,255,0.14),transparent_55%),radial-gradient(circle_at_20%_80%,rgba(185,192,255,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 gradient-line opacity-80" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Faq title="FAQ" subtitle="Quick answers so you can decide fast." items={faq} />
        </div>
      </section>

      {/* End CTA */}
      <FinalCTA />
    </main>
  );
}