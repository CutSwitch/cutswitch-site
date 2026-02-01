type Props = {
  embedded?: boolean;
};

export default function FinalCTA({ embedded = false }: Props) {
  const outerPadding = embedded ? "pt-14 pb-16" : "py-16 sm:py-24";

  return (
    <section aria-label="Final call to action" className={`relative overflow-hidden ${outerPadding}`}>
      {/* Full-bleed background (Frame.io-style band) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Base */}
        <div className="absolute inset-0 bg-[#0e101f]" />

        {/* Video */}
        <div className="absolute inset-[-18%] cta-wave-mask">
          <video
            className="h-full w-full object-cover opacity-80 [filter:brightness(1.25)_contrast(1.05)]"
            autoPlay
            playsInline
            muted
            loop
            preload="auto"
          >
            {/*
              Prefer AV1 when supported (best compression),
              fall back to VP9, and finally H.264 MP4.
            */}
            <source src="/illust/cta-loop-av1.webm" type='video/webm; codecs="av01"' />
            <source src="/illust/cta-loop-vp9.webm" type='video/webm; codecs="vp09"' />
            <source src="/illust/cta-loop.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Blend overlays (keep it on-brand + prevent hard edges) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(112,92,255,0.35),_transparent_65%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e101f] via-transparent to-[#0e101f]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e101f] via-transparent to-[#0e101f] opacity-80" />
      </div>

      {/* Content */}
      <div className="container-edge relative z-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] sm:text-4xl">
            Start using CutSwitch
            <br />
            today for free.
          </h2>

          <div className="mt-8">
            <a
              className="btn btn-primary rounded-full px-8 py-3 text-base shadow-[0_18px_50px_rgba(112,92,255,0.25)]"
              href="/pricing"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
