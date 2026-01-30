export default function FinalCTA({ embedded = false }: { embedded?: boolean }) {
  const outerPadding = embedded ? "" : "py-24 sm:py-28";
  const innerPadding = embedded ? "min-h-[260px] py-14 sm:py-16" : "min-h-[340px] py-16 sm:py-20";

  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${outerPadding}`}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink/40 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]">
        {/* Background video */}
        <div className="absolute inset-0">
          <video
            className="h-full w-full object-cover opacity-90 motion-reduce:hidden"
            src="/illust/cta-loop.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          />

          {/*
            Soft overlays to keep text readable and prevent the video from reading as a hard
            horizontal band. The gradients also blend into the page background.
          */}
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_40%,rgba(90,65,255,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/95 via-ink/55 to-ink/95" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-transparent to-ink/80" />
        </div>

        {/* Content */}
        <div className={`relative z-10 flex flex-col items-center justify-center text-center ${innerPadding}`}>
          <div className="cta-copy px-7 py-9 sm:px-10 sm:py-10">
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Start using CutSwitch
              <br />
              today for free.
            </h2>

            <div className="mt-7 flex items-center justify-center">
              <a href="/pricing" className="btn-primary">
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
