export default function FinalCTA({ embedded = false }: { embedded?: boolean }) {
  const outerPadding = embedded ? "" : "py-24 sm:py-28";
  const innerPadding = embedded ? "min-h-[260px] py-14 sm:py-16" : "min-h-[340px] py-16 sm:py-20";

  return (
    <section className={`mx-auto max-w-6xl px-4 sm:px-6 ${outerPadding}`}>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink/35 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_24px_80px_rgba(0,0,0,0.55)]">
        {/* Background loop (WebM/MP4). */}
        <div className="absolute inset-0" aria-hidden="true">
          <video
            className="h-full w-full object-cover opacity-100"
            style={{ filter: "brightness(1.45) saturate(1.1) contrast(1.05)" }}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          >
            <source src="/illust/cta-loop.webm" type="video/webm" />
            <source src="/illust/cta-loop.mp4" type="video/mp4" />
          </video>

          {/*
            Soft overlays to keep text readable and prevent the video from reading as a hard
            horizontal band. The gradients also blend into the page background.
          */}
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_40%,rgba(90,65,255,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/35 to-ink/75" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-transparent to-ink/60" />
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
