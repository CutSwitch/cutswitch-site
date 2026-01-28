import { DownloadCTA } from "@/components/DownloadCTA";

export function FinalCTA({ embedded }: { embedded?: boolean }) {
  const sectionClassName = embedded
    ? "relative isolate mt-10"
    : "relative isolate mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20";

  return (
    <section className={sectionClassName}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-10 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-12">
        {/* Single wave system with soft fade at edges (via .cta-wave-mask) */}
        <div className="pointer-events-none absolute inset-0 opacity-70 cta-wave-mask">
          <svg
            className="h-full w-full"
            viewBox="0 0 1000 240"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g fill="none" stroke="rgba(142, 160, 255, 0.40)" strokeWidth="2">
              <path d="M0 120 C 160 60, 320 180, 480 120 S 800 60, 1000 120" />
              <path d="M0 140 C 180 90, 340 190, 520 140 S 820 90, 1000 140" />
              <path d="M0 100 C 140 40, 300 160, 460 100 S 780 40, 1000 100" />
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="translate"
                from="0 0"
                to="-220 0"
                dur="7s"
                repeatCount="indefinite"
              />
            </g>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Start using CutSwitch
            <br />
            today for free.
          </h2>
          <p className="mt-3 max-w-prose text-sm text-white/70 sm:text-base">
            Get a clean first cut fast, then refine in Final Cut like normal.
          </p>

          <div className="mt-6">
            <DownloadCTA href="/pricing" label="Start Free Trial" />
          </div>
        </div>
      </div>
    </section>
  );
}
