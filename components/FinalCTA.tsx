import { cn } from "@/lib/utils";

type FinalCTAProps = {
  embedded?: boolean;
};

export function FinalCTA({ embedded }: FinalCTAProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        embedded ? "" : "border-t border-line",
      )}
    >
      {/* Soft glow behind everything */}
      <div
        className="pointer-events-none absolute inset-0 cta-glow"
        aria-hidden="true"
      />

      {/* Single wave system (no duplicated layers) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden cta-wave-mask"
        aria-hidden="true"
      >
        {/*
          We center the *wrapper* vertically so we can keep the SVG animation on
          transform (translateX) without fighting Tailwind translateY classes.
        */}
        <div className="absolute left-0 top-1/2 w-full -translate-y-1/2">
          <svg
            className="cta-wave-svg block h-[200px] w-[200%] opacity-65 sm:h-[240px]"
            viewBox="0 0 1440 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 55C160 15 320 15 480 55C640 95 800 95 960 55C1120 15 1280 15 1440 55"
              stroke="rgba(143, 158, 255, 0.65)"
              strokeWidth="2"
            />
            <path
              d="M0 70C160 30 320 30 480 70C640 110 800 110 960 70C1120 30 1280 30 1440 70"
              stroke="rgba(143, 158, 255, 0.35)"
              strokeWidth="2"
            />
            <path
              d="M0 40C160 0 320 0 480 40C640 80 800 80 960 40C1120 0 1280 0 1440 40"
              stroke="rgba(143, 158, 255, 0.25)"
              strokeWidth="2"
            />
            <path
              d="M0 85C160 45 320 45 480 85C640 125 800 125 960 85C1120 45 1280 45 1440 85"
              stroke="rgba(143, 158, 255, 0.18)"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>

      {/* Copy centered inside the wave field */}
      <div className="container-edge relative z-10 flex min-h-[360px] items-center justify-center py-20 sm:min-h-[420px] sm:py-24">
        <div className="cta-copy max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Start using CutSwitch
            <br />
            today for free.
          </h2>
          <div className="mt-7 flex justify-center">
            <a href="/pricing" className="btn-primary">
              Start Free Trial
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
