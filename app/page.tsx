import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { VideoDemo } from "@/components/VideoDemo";
import { FeatureGrid } from "@/components/FeatureGrid";
import { HowItWorks } from "@/components/HowItWorks";
import { Comparison } from "@/components/Comparison";
import { TestimonialGrid } from "@/components/TestimonialGrid";
import { Faq } from "@/components/Faq";
import { PricingTable } from "@/components/pricing/PricingTable";
import { FinalCTA } from "@/components/FinalCTA";
import {
  IconCamera,
  IconExport,
  IconLock,
  IconScissors,
  IconSpark,
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
    title: "Voice-driven multicam switching",
    description:
      "Drop one audio file per speaker and CutSwitch switches angles based on who's actually talking, moment by moment.",
  },
  {
    icon: <IconScissors className="h-5 w-5" />,
    title: "Cut styles that feel edited",
    description:
      "Choose Calm, Normal, or Punchy. Or turn on Custom to tune sensitivity, minimum shot length, and smoothing.",
  },
  {
    icon: <IconUsers className="h-5 w-5" />,
    title: "Tasteful group shots",
    description:
      "Set how often we cut to wide or two-shot. Presets for speed, Custom controls for pros who want the knobs.",
  },
  {
    icon: <IconCamera className="h-5 w-5" />,
    title: "Simple speaker-to-camera mapping",
    description:
      "Match each speaker to a camera angle. Multiple speakers can share one angle, so two-shots and shared cams just work.",
  },
  {
    icon: <IconExport className="h-5 w-5" />,
    title: "Export right back into Final Cut",
    description:
      "CutSwitch outputs a fresh .fcpxmld bundle. Import it into Final Cut Pro and keep editing like normal.",
  },
  {
    icon: <IconLock className="h-5 w-5" />,
    title: "Local-first by design",
    description:
      "Runs on your Mac. Your media stays local. No uploads, no cloud processing, no weird surprises.",
  },
];

const steps = [
  {
    icon: <IconExport className="h-5 w-5" />,
    title: "Import your Final Cut project",
    description: "Drop a .fcpxml or .fcpxmld with a real multicam clip.",
  },
  {
    icon: <IconWaveform className="h-5 w-5" />,
    title: "Add one audio file per speaker",
    description:
      "Each file becomes that speaker's “voice meter” so CutSwitch can detect who's talking.",
  },
  {
    icon: <IconCamera className="h-5 w-5" />,
    title: "Map speakers to camera angles",
    description:
      "Choose which angle shows each person. Share angles when two people are on the same camera.",
  },
  {
    icon: <IconSpark className="h-5 w-5" />,
    title: "Pick the rhythm",
    description:
      "Set Group frequency and Cut Style. Flip on Custom if you want the fine-tuning controls.",
  },
  {
    icon: <IconScissors className="h-5 w-5" />,
    title: "Run CutSwitch",
    description:
      "Generate the finished timeline and import it into Final Cut Pro. The edit is yours to polish.",
  },
];

const comparisons = [
  {
    feature: "What you do",
    manual: "Listen, scrub, switch, undo, repeat",
    cutswitch: "Set it once, export, refine",
  },
  {
    feature: "Dialogue switching",
    manual: "Manual angle hunting and keyframes",
    cutswitch: "Automatic based on speech",
  },
  {
    feature: "Consistency",
    manual: "Depends on how tired you are",
    cutswitch: "Repeatable presets + Custom",
  },
  {
    feature: "Wide shots",
    manual: "You remember to add them",
    cutswitch: "Built-in group shot cadence",
  },
  {
    feature: "Privacy",
    manual: "Local (you)",
    cutswitch: "Local-first (always)",
  },
];

const testimonials = [
  {
    quote:
      "CutSwitch gets me 80% of the way there in minutes. I spend my time on story beats instead of babysitting the multicam.",
    name: "Early Beta Editor",
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
    a: "A Final Cut Pro multicam project export (.fcpxml or .fcpxmld) and one audio file per speaker. Then map speakers to camera angles.",
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
    q: "Is there a beta / trial?",
    a: "Yes. We’re in beta right now. Download the build and send feedback. The app includes a built-in “Help → Report Bug” diagnostics export.",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="relative isolate overflow-hidden">
  {/* Background layers (kept behind content to avoid “overlay” artifacts) */}
  <div className="pointer-events-none absolute inset-0 -z-10 bg-hero-radial opacity-90" />
  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(101,93,255,0.25),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(101,93,255,0.10),transparent_60%)]" />
  {/* Bottom fade to blend into the page background (reduces hard seams between sections) */}
  <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-b from-transparent to-ink" />

  <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
    <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
      <div className="max-w-2xl lg:col-span-5">
        <div className="chip w-fit">macOS app · Final Cut Pro multicam</div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Auto-switch your multicam by who’s speaking.
        </h1>

        <p className="mt-6 text-base leading-relaxed text-white/70 sm:text-lg">
          Import a Final Cut XML, attach one audio file per speaker, pick a rhythm. CutSwitch generates a clean, editable cut plan that follows the conversation.
        </p>

        {/* Mobile: place the demo loop directly under the explainer paragraph */}
        <div className="mt-8 lg:hidden">
          <VideoDemo className="mx-auto w-full" />
          <p className="mt-3 text-xs text-white/60">
            Real pipeline, real output. Import the result into Final Cut Pro and refine.
          </p>
        </div>

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

      {/* Desktop: larger Frame.io-style demo block */}
      <div className="hidden lg:block lg:col-span-7 lg:pt-2">
        <VideoDemo className="mx-auto w-full" />
        <p className="mt-3 text-xs text-white/60">
          Real pipeline, real output. Import the result into Final Cut Pro and refine.
        </p>
      </div>
    </div>
  </div>
</header>

      <FeatureGrid
        title="Built for conversation edits"
        subtitle="CutSwitch handles the switching so you can spend your energy on story, pacing, and punchlines."
        features={features}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16"
      />

      <HowItWorks
        title="How it works"
        subtitle="A fast setup. A clean export. Then you’re back in Final Cut where you belong."
        steps={steps}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16"
      />

      <Comparison
        title="Manual switching vs CutSwitch"
        subtitle="Same end goal. Very different path to get there."
        rows={comparisons}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16"
      />

      <TestimonialGrid
        title="What early editors are saying"
        subtitle="Beta feedback has been consistent: less clicking, more control, better rhythm."
        items={testimonials}
        className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16"
      />

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Affiliate program</h3>
                <p className="mt-2 text-sm text-white/70">
                  Recommend CutSwitch to editors and get paid. We provide tracking links, assets, and recurring commissions.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/affiliates" className="btn btn-secondary">
                  Become an affiliate
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-14 sm:py-16">
        <PricingTable />
      </section>
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Faq title="FAQ" subtitle="Quick answers so you can decide fast." items={faq} />
        </div>
      </section>
      <section className="py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <FinalCTA />
        </div>
      </section>
    </main>
  );
}