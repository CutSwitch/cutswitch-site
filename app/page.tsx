import Link from "next/link";
import { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { SectionHeading } from "@/components/SectionHeading";
import { VideoDemo } from "@/components/VideoDemo";
import { HowItWorks } from "@/components/HowItWorks";
import { FeatureGrid } from "@/components/FeatureGrid";
import { Comparison } from "@/components/Comparison";
import { TestimonialGrid } from "@/components/TestimonialGrid";
import { Faq } from "@/components/Faq";
import { FinalCTA } from "@/components/FinalCTA";

export const metadata: Metadata = {
  title: "CutSwitch",
  description: siteConfig.description,
};

export default function HomePage() {
  const steps = [
    {
      title: "Install in minutes",
      description:
        "Download CutSwitch, drop it into Applications, and you're live. No drama. No installer maze.",
    },
    {
      title: "Set your shortcuts",
      description:
        "Pick the actions you want, map them to keys, and let muscle memory do the rest.",
    },
    {
      title: "Edit with guardrails",
      description:
        "CutSwitch automates the repetitive micro-work, so you stay focused on story and pacing.",
    },
  ];

  const features = [
    {
      title: "Keyboard-first speed",
      description:
        "The best tools disappear. CutSwitch makes common actions feel instant and predictable.",
    },
    {
      title: "Non-destructive workflow",
      description:
        "Designed to stay out of your way. Everything is reversible and built for confidence under deadlines.",
    },
    {
      title: "Precision, not complexity",
      description:
        "Minimal UI, maximum clarity. You get results, not a new part-time job learning menus.",
    },
    {
      title: "Built for macOS",
      description:
        "Native-feeling performance with a premium dark interface that doesn't fight your eyes.",
    },
    {
      title: "License for 2 Macs",
      description:
        "One license covers your main machine and your travel rig. Swap devices when needed.",
    },
    {
      title: "Trial that respects you",
      description:
        "Start a 7-day trial on subscription plans. Cancel before it renews. No refund games.",
    },
    {
      title: "Affiliate-friendly checkout",
      description:
        "Rewardful tracking plus promo codes. Partners get credit even when buyers use codes.",
    },
    {
      title: "Stripe Tax enabled",
      description:
        "Taxes and VAT are calculated automatically at checkout based on buyer location and tax IDs.",
    },
    {
      title: "Support that shows up",
      description:
        "Real humans, fast answers. If something is broken, we'll help you get it working fast.",
    },
  ];

  const testimonials = [
    {
      quote:
        "CutSwitch shaved minutes off every scene. It sounds small until you realize you do it hundreds of times per week.",
      name: "Ari M.",
      title: "Editor, documentary + branded",
    },
    {
      quote:
        "Premium vibe, zero fluff. It feels like it was designed by someone who actually edits under deadlines.",
      name: "Sam K.",
      title: "Post supervisor",
    },
    {
      quote:
        "My favorite part is the consistency. No more random UI detours that break concentration.",
      name: "Jules R.",
      title: "Filmmaker / creator",
    },
  ];

  const faq = [
    {
      q: "Is there a free trial?",
      a: "Yes. Subscription plans include a 7-day free trial. Stripe Checkout collects a card to prevent abuse, but you won't be charged until the trial ends.",
    },
    {
      q: "Do you offer refunds?",
      a: "No. All sales are final. We put the policy everywhere on purpose. If something is broken or confusing, Support will help you get it working fast.",
    },
    {
      q: "How many Macs can I use?",
      a: "2 active devices per license. This is enforced via Keygen activation limits and validated by the app.",
    },
    {
      q: "How do affiliates get credit?",
      a: "We use Rewardful for tracking. Referrals are credited via link tracking and can also work with promo codes at checkout.",
    },
    {
      q: "Can I cancel my subscription?",
      a: "Yes. You can cancel any time. If you cancel during the trial, you won't be charged. We'll include instructions in your purchase email and on the Account page.",
    },
  ];

  return (
    <div>
      {/* Hero (Frame.io-inspired split) */}
      <section className="container-edge">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-6 py-12 sm:px-10 sm:py-16">
          {/* background depth */}
          <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-90" />
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-highlight/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-28 top-24 h-80 w-80 rounded-full bg-[#655DFF]/15 blur-3xl" />

          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="max-w-xl">
              <div className="flex flex-wrap gap-2">
                <span className="chip">
                  <span className="text-brand-highlight">Mac app</span>
                </span>
                <span className="chip">7-day trial</span>
                <span className="chip">2-device license</span>
                <span className="chip">Stripe Tax</span>
              </div>

              <h1 className="mt-7 text-5xl font-semibold tracking-tight sm:text-6xl">
                Multicam in seconds. <span className="text-brand-highlight">Save hours.</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
                CutSwitch is a premium Mac utility for FCPX. From mono audio to multicam switches, in seconds.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link className="btn btn-primary" href="/pricing">
                  Get CutSwitch <span className="text-white/80">→</span>
                </Link>
                <Link className="btn btn-secondary" href="/demo">
                  Watch demo
                </Link>
              </div>

              <p className="mt-4 text-xs text-white/50">
                Need help before buying?{" "}
                <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
                  Support is prominent on purpose
                </Link>
                .
              </p>
            </div>

            {/* Hero video (looping preview) */}
            <div className="relative lg:animate-floaty">
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-[radial-gradient(circle_at_40%_30%,rgba(101,93,255,0.22),transparent_60%)] blur-xl" />
              <VideoDemo className="aspect-[16/10] shadow-soft" chrome />
            </div>
          </div>
        </div>
      </section>

      {/* Demo (preview + route to full walkthrough) */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="Demo"
          title="A quick preview of the workflow."
          subtitle="This is a looping preview. For the full walkthrough with sound, jump into the demo page."
        />
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-white/50">
              Tip: click the video to expand. Want audio?{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/demo">
                Open the full demo
              </Link>
              .
            </div>
          </div>
          <div className="mt-3">
            <VideoDemo className="shadow-soft" chrome />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps from install to 'why didn't I have this earlier?'"
        />
        <HowItWorks steps={steps} className="mt-6" />
      </section>

      {/* Features */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="Features"
          title="Premium feel, practical wins."
          subtitle="Everything here is tuned for speed, confidence, and less friction between you and the edit."
        />
        <FeatureGrid features={features} className="mt-6" />
      </section>

      {/* Comparison */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="Why CutSwitch"
          title="Manual editing vs CutSwitch"
          subtitle="The difference is not magic. It's fewer interruptions. Less context switching. More time where it counts."
        />
        <div className="mt-6">
          <Comparison />
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="Testimonials"
          title="Editors talk. We listen."
          subtitle="Replace these with real quotes when you have them. The layout is already built for premium social proof."
        />
        <TestimonialGrid items={testimonials} className="mt-6" />
      </section>

      {/* FAQ */}
      <section className="container-edge mt-14">
        <SectionHeading
          eyebrow="FAQ"
          title="The honest answers."
          subtitle="If a question reduces chargebacks and confusion, it belongs here."
        />
        <Faq items={faq} className="mt-6" />
      </section>

      {/* Final CTA */}
      <section className="container-edge mt-14">
        <FinalCTA />
      </section>
    </div>
  );
}
