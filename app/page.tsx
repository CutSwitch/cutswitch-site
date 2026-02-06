import Link from "next/link";
import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { VideoDemo } from "@/components/VideoDemo";
import { TestimonialGrid } from "@/components/TestimonialGrid";
import { PricingTable } from "@/components/pricing/PricingTable";
import FinalCTA from "@/components/FinalCTA";
import { SpeedProofBackground } from "@/components/SpeedProofBackground";

export const metadata: Metadata = {
  title: `${siteConfig.name} | ${siteConfig.tagline}`,
  description: siteConfig.description,
};

const testimonials = [
  {
    quote:
      "CutSwitch gets me 80% of the way there in minutes. I spend my time on story beats instead of babysitting the multicam.",
    name: "Peter H.",
    title: "Early Editor · Podcasts + Interviews",
  },
  {
    quote:
      "The rhythm presets are shockingly useful. Punchy nails the “yeah / mm-hmm” moments without me chasing angles all day.",
    name: "Michael R.",
    title: "Post Producer · YouTube / Social",
  },
  {
    quote:
      "Custom mode is the pro move. I can tune the sensitivity and minimum shot length and the edit suddenly feels intentional.",
    name: "Seth B.",
    title: "Multicam Editor · Longform Conversations",
  },
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <header data-hero-parallax className="relative -mt-10">
        {/* Animated hero backdrop (video) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <video
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70"
            src="/illust/hero-intro-smoke.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{
              filter: "brightness(1.35) saturate(1.05) contrast(1.05)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[#0e101f]/55" />
        </div>

        <div className="container-edge relative z-10 py-16 sm:py-20">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-12 lg:items-start">
            {/* Copy */}
            <div className="max-w-2xl lg:col-start-1 lg:row-start-1 hero-parallax-text">
              <div className="chip w-fit">macOS app · Final Cut Pro multicam</div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                <span className="block">Instantly Edit Podcasts</span>
                <span className="block">in Final Cut Pro.</span>
              </h1>

              <p className="mt-6 text-base leading-relaxed text-white/70 sm:text-lg">
                Import a Final Cut XML, and instantly edit a multi-cam interview or podcast.
              </p>
            </div>

            {/* Video (mobile: directly under paragraph) */}
            <div className="lg:col-start-2 lg:row-span-2 lg:pt-2 hero-parallax-video">
              <VideoDemo className="mx-auto w-full max-w-xl lg:max-w-none" />
            </div>

            {/* Actions (mobile: below video) */}
            <div className="lg:col-start-1 lg:row-start-2 hero-parallax-actions">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/download" className="btn btn-primary">
                    Get CutSwitch
                    <span aria-hidden>→</span>
                  </Link>
                  <Link href="/demo" className="btn btn-secondary">
                    Watch the demo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

      </header>

      {/* Speed proof: MP4 background, centered headline */}
      <section className="speedproof relative overflow-hidden py-20 sm:py-24 lg:py-32 min-h-[520px] sm:min-h-[600px] lg:min-h-[680px]">
        <SpeedProofBackground />

        <div className="container-edge scene-content flex min-h-[520px] sm:min-h-[600px] lg:min-h-[680px] items-center justify-center">
          <div className="speedproof-copy mx-auto max-w-3xl text-center -mt-4 sm:-mt-6">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Cut in minutes — not hours.
            </h2>
            <div className="mt-7 flex justify-center">
              <Link href="/pricing" className="btn btn-primary">
                Explore plans <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>

      </section>

      {/* Continuous background: features → testimonials → affiliates → pricing → questions → final CTA */}
      <section className="scene scene--flow">

        <div className="scene-content">
          <div className="container-edge py-16 sm:py-20">
            <TestimonialGrid
              title="What early editors are saying"
              subtitle="Early feedback has been consistent: less clicking, more control, better rhythm."
              items={testimonials}
            />
          </div>

          <div className="container-edge py-16 sm:py-20">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <h3 className="text-xl font-semibold text-white">Affiliate program</h3>
                  <p className="mt-2 text-sm text-white/70">
                    Recommend CutSwitch to editors and get paid. We provide tracking links, assets, and recurring
                    commissions.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Link href="/affiliates" className="btn btn-secondary">
                      Become an affiliate
                    </Link>
                  </div>
                </div>

                <div className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_20px_80px_rgba(0,0,0,0.55)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_28px_110px_rgba(0,0,0,0.65)]">
                  <div className="aspect-[16/9]">
                    <img
                      src="/illust/affiliate-earnings.gif"
                      alt="Affiliate earnings preview"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing flows into CTA (still embedded) */}
          <div className="pb-4">
            <PricingTable embedded />
            <FinalCTA embedded />
          </div>
        </div>
      </section>
    </main>
  );
}
