import Link from "next/link";
import { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { SectionHeading } from "@/components/SectionHeading";
import { VideoDemo } from "@/components/VideoDemo";
import { SmartImage } from "@/components/SmartImage";
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
        "Real humans, fast answers. If something is broken, we'll help you fix it quickly.",
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
      {/* Hero */}
      <section className="container-edge">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-6 py-12 sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-90" />

          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="chip">
                  <span className="text-brand-highlight">Mac app</span>
                </span>
                <span className="chip">7-day trial</span>
                <span className="chip">2-device license</span>
                <span className="chip">Stripe Tax</span>
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
                Switch cuts. <span className="text-brand-highlight">Stay in flow.</span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                CutSwitch is a premium Mac utility that automates repetitive editorial micro-work.
                It keeps your hands on the keys, your eyes on the timeline, and your brain on the story.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="btn btn-primary" href="/pricing">
                  Get CutSwitch <span className="text-white/80">→</span>
                </Link>
                <Link className="btn btn-secondary" href="#demo">
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

            <div className="grid gap-4 sm:grid-cols-2">
              <SmartImage
                src="/images/screen1.png"
                alt="CutSwitch screenshot 1"
                className="h-[220px] w-full object-cover sm:h-[260px]"
                fallbackLabel="Screenshot 1"
              />
              <SmartImage
                src="/images/screen2.png"
                alt="CutSwitch screenshot 2"
                className="h-[220px] w-full object-cover sm:h-[260px] sm:translate-y-6 sm:animate-floaty"
                fallbackLabel="Screenshot 2"
              />
              <div className="sm:col-span-2">
                <SmartImage
                  src="/images/screen3.png"
                  alt="CutSwitch screenshot 3"
                  className="h-[220px] w-full object-cover sm:h-[240px]"
                  fallbackLabel="Screenshot 3"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="container-edge mt-14">
        <SectionHeading
          eyebrow="Demo"
          title="See the vibe. Hear the speed."
          subtitle="Drop in your own MP4 at /public/videos/demo.mp4. This section is built to feel like a premium product page, not a noisy carnival."
        />
        <div className="mt-6">
          <VideoDemo className="shadow-soft" />
        </div>
      </section>

      {/* Social proof */}
      <section className="container-edge mt-14">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Trusted by editors at places that care about deadlines
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {["Studio A", "PostCo", "FrameHouse", "Signal", "NorthCut", "Tape&Tea"].map((name) => (
              <div
                key={name}
                className="grid place-items-center rounded-xl border border-white/10 bg-white/5 py-3 text-xs text-white/55"
              >
                {name}
              </div>
            ))}
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
