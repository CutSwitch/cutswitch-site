import Link from "next/link";
import { cn } from "@/lib/utils";

type FinalCTAProps = {
  /** When true, removes the top divider and tightens padding so it can flow from the previous section. */
  embedded?: boolean;
};

export function FinalCTA({ embedded = false }: FinalCTAProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        embedded ? "pt-10 pb-20 sm:pt-12 sm:pb-24" : "py-20 sm:py-24"
      )}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(101,93,255,0.22),transparent_60%),radial-gradient(circle_at_20%_35%,rgba(185,192,255,0.12),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(75,60,255,0.12),transparent_60%)]" />

      {/* Section divider (only when this CTA is its own scene) */}
      {!embedded ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 gradient-line opacity-80" />
      ) : null}

      {/* CTA content */}
      <div className="container-edge relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white/95 sm:text-4xl">
            Start using CutSwitch
            <span className="block">today for free.</span>
          </h2>

          <div className="mt-7 flex justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-7 py-2.5 text-sm font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>

      {/* Animated waves (Frame.io-ish, CutSwitch colored) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-56 overflow-hidden cta-wave-mask">
        {/* back layer */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 2400 240"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-full w-[200%] opacity-55 cta-wave-svg cta-wave-svg-slow"
        >
          <defs>
            <linearGradient id="csWaveGradBack" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(101,93,255,0)" />
              <stop offset="20%" stopColor="rgba(101,93,255,0.55)" />
              <stop offset="50%" stopColor="rgba(185,192,255,0.40)" />
              <stop offset="80%" stopColor="rgba(101,93,255,0.55)" />
              <stop offset="100%" stopColor="rgba(101,93,255,0)" />
            </linearGradient>
            <g id="csWaveSetBack" fill="none" stroke="url(#csWaveGradBack)" strokeLinecap="round">
              <path
                d="M0 175 C 200 115 400 235 600 175 C 800 115 1000 235 1200 175"
                strokeWidth="3"
                opacity="0.55"
              />
              <path
                d="M0 195 C 220 130 420 255 620 195 C 820 135 1020 255 1220 195"
                strokeWidth="2"
                opacity="0.45"
              />
              <path
                d="M0 155 C 200 105 410 225 610 155 C 810 105 1010 225 1210 155"
                strokeWidth="2"
                opacity="0.40"
              />
            </g>
          </defs>

          <use href="#csWaveSetBack" x="0" />
          <use href="#csWaveSetBack" x="1200" />
        </svg>

        {/* front layer */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 2400 240"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 h-full w-[200%] opacity-80 cta-wave-svg"
        >
          <defs>
            <linearGradient id="csWaveGradFront" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(101,93,255,0)" />
              <stop offset="18%" stopColor="rgba(101,93,255,0.75)" />
              <stop offset="50%" stopColor="rgba(185,192,255,0.65)" />
              <stop offset="82%" stopColor="rgba(101,93,255,0.75)" />
              <stop offset="100%" stopColor="rgba(101,93,255,0)" />
            </linearGradient>
            <g id="csWaveSetFront" fill="none" stroke="url(#csWaveGradFront)" strokeLinecap="round">
              <path
                d="M0 185 C 200 120 400 245 600 185 C 800 120 1000 245 1200 185"
                strokeWidth="3"
                opacity="0.9"
              />
              <path
                d="M0 205 C 220 140 420 265 620 205 C 820 145 1020 265 1220 205"
                strokeWidth="2"
                opacity="0.7"
              />
              <path
                d="M0 165 C 200 110 410 235 610 165 C 810 110 1010 235 1210 165"
                strokeWidth="2"
                opacity="0.55"
              />
            </g>
          </defs>

          <use href="#csWaveSetFront" x="0" />
          <use href="#csWaveSetFront" x="1200" />
        </svg>
      </div>
    </section>
  );
}
