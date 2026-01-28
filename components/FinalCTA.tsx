"use client";

import { DownloadCTA } from "@/components/DownloadCTA";

export type FinalCTAProps = {
  /**
   * When true, this CTA is rendered inside another section (eg. embedded under Pricing on the home page).
   * Used only for spacing so consumers can opt into tighter layout.
   */
  embedded?: boolean;
};

export function FinalCTA({ embedded = false }: FinalCTAProps) {
  const outerPadding = embedded ? "py-0" : "py-16 sm:py-20";
  const containerMargin = embedded ? "mt-10" : "mt-16";

  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${outerPadding}`}>
      <DownloadCTA
        title={
          <>
            Start using CutSwitch
            <br />
            today for free.
          </>
        }
        subtitle="A cleaner first cut, in less time. Try it for free."
        buttonLabel="Start Free Trial"
        buttonHref="/pricing"
        variant="waves"
        align="center"
        // Keep the content visually centered within the wave band.
        contentClassName="flex items-center justify-center min-h-[240px] sm:min-h-[280px]"
        // Ensure the wave band never feels like a hard clipped stripe.
        backgroundClassName="mask-edge-soft"
        // The CTA background lives in the same global background system; no extra section stripes.
        containerClassName={containerMargin}
      />
    </section>
  );
}
