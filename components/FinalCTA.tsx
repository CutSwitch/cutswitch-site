"use client";

import { DownloadCTA } from "@/components/DownloadCTA";

export function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="relative mt-16 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 sm:px-10 sm:py-20">
        {/*
          Single animated wave system.
          The wrapper is flex-centered so the wave band lives behind the CTA content,
          rather than feeling like a stripe above or below it.
        */}
        <div className="absolute inset-0 -z-10 cta-wave-mask pointer-events-none flex items-center justify-center">
          <svg
            className="w-[120%] h-[70%] opacity-40"
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <path
                d="M0 116 C 140 96, 240 136, 380 116 C 520 96, 620 136, 760 116 C 900 96, 1020 136, 1200 112"
                stroke="rgba(255,255,255,0.38)"
                strokeWidth="1.4"
              />
              <path
                d="M0 96 C 160 116, 260 76, 420 96 C 580 116, 700 76, 860 96 C 1020 116, 1100 78, 1200 92"
                stroke="rgba(101,93,255,0.65)"
                strokeWidth="1.2"
              />
              <path
                d="M0 138 C 180 120, 280 156, 460 138 C 640 120, 740 156, 920 138 C 1100 120, 1160 154, 1200 132"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="1.1"
              />
              <path
                d="M0 72 C 210 92, 300 52, 510 72 C 720 92, 810 52, 1020 72 C 1110 80, 1160 76, 1200 70"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
              />

              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="translate"
                dur="12s"
                values="0 0; -80 0; 0 0"
                repeatCount="indefinite"
              />
            </g>
          </svg>
        </div>

        <div className="relative mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Start using CutSwitch
            <br />
            today for free.
          </h2>
          <div className="mt-6 flex justify-center">
            <DownloadCTA />
          </div>
        </div>
      </div>
    </section>
  );
}
