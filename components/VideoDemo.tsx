"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

type VideoDemoProps = {
  className?: string;
  /** Frame.io-ish: hover glow + subtle parallax + click to expand */
  interactive?: boolean;
  /** Adds a subtle macOS-style window frame around the video (best for hero). */
  chrome?: boolean;
};

export function VideoDemo({ className, interactive = true, chrome = true }: VideoDemoProps) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Smooth tilt without re-rendering on every mouse move.
  const targetTilt = useRef({ rx: 0, ry: 0 });
  const currentTilt = useRef({ rx: 0, ry: 0 });
  const rafId = useRef<number | null>(null);

  // iOS/Safari nuance: autoplay is more reliable when we only apply
  // transforms/hover interactions on devices that actually support hover.
  // (Transformed parents can sometimes interfere with video autoplay on mobile.)
  const isInteractive = interactive && canHover;

  // Keep tilt stable when switching between interactive/non-interactive modes.
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    targetTilt.current = { rx: 0, ry: 0 };
    currentTilt.current = { rx: 0, ry: 0 };
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, [isInteractive]);

  const startRaf = () => {
    if (rafId.current) return;
    const tick = () => {
      rafId.current = null;
      const el = tiltRef.current;
      if (!el || !isInteractive) return;

      const cur = currentTilt.current;
      const tgt = targetTilt.current;
      // Inertia smoothing.
      const ease = 0.14;
      cur.rx += (tgt.rx - cur.rx) * ease;
      cur.ry += (tgt.ry - cur.ry) * ease;

      el.style.setProperty("--rx", `${cur.rx.toFixed(3)}deg`);
      el.style.setProperty("--ry", `${cur.ry.toFixed(3)}deg`);

      if (Math.abs(tgt.rx - cur.rx) > 0.001 || Math.abs(tgt.ry - cur.ry) > 0.001) {
        rafId.current = requestAnimationFrame(tick);
      }
    };
    rafId.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    // Desktop-only hover/tilt. On touch devices we disable it.
    if (typeof window === "undefined") return;
    const m = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    const update = () => setCanHover(Boolean(m?.matches));
    update();
    if (!m) return;
    m.addEventListener?.("change", update);
    return () => m.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    // Autoplay: keep it muted + inline. Some browsers (especially iOS Safari)
    // can be picky, so we:
    // 1) set all relevant flags/attrs
    // 2) try play on mount + on canplay
    // 3) retry once on the first user gesture (scroll/tap) so users don't have
    //    to hit the tiny play button.
    const v = videoRef.current;
    if (!v || broken) return;

    let cancelled = false;

    const ensurePlaying = () => {
      if (cancelled) return;
      try {
        v.muted = true;
        v.defaultMuted = true;
        v.volume = 0;
        v.autoplay = true;
        v.loop = true;
        v.controls = false;
        v.playsInline = true;
        // Keep iOS from bouncing to full-screen.
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        v.setAttribute("muted", "");

        // Prevent PiP/remote playback UIs from taking over.
        // (Safari supports these attrs, Chrome ignores them.)
        v.setAttribute("disablepictureinpicture", "true");
        v.setAttribute("disableremoteplayback", "true");

        const p = v.play();
        if (p && typeof (p as Promise<void>).catch === "function") {
          (p as Promise<void>).catch(() => {
            // Autoplay can still be blocked. We'll retry on first gesture.
          });
        }
      } catch {
        // Ignore.
      }
    };

    ensurePlaying();

    const onCanPlay = () => ensurePlaying();
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("loadeddata", onCanPlay);

    const onVis = () => {
      if (!document.hidden) ensurePlaying();
    };
    document.addEventListener("visibilitychange", onVis);

    // One-shot gesture fallback. This usually triggers immediately when the
    // user scrolls the page or taps anywhere.
    const onFirstGesture = () => ensurePlaying();
    window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });
    window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
    window.addEventListener("scroll", onFirstGesture, { once: true, passive: true });

    return () => {
      cancelled = true;
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("loadeddata", onCanPlay);
      document.removeEventListener("visibilitychange", onVis);
      // The gesture listeners are {once:true} but we still remove for cleanliness.
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("scroll", onFirstGesture);
    };
  }, [broken]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isInteractive) return;
    const el = wrapRef.current;
    if (!el) return;
    // Measure the *untransformed* wrapper so the math doesn't jitter.
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const ry = (px - 0.5) * 5; // subtle
    const rx = (0.5 - py) * 3.5;

    targetTilt.current = { rx, ry };
    startRaf();
  };

  const onLeave = () => {
    if (!isInteractive) return;
    targetTilt.current = { rx: 0, ry: 0 };
    startRaf();
  };

  const CardInner = (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {!broken ? (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/videos/demo.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="grid min-h-[260px] place-items-center p-10 text-center">
          <div>
            <div className="text-sm font-semibold text-white/85">Demo video not found</div>
            <div className="mt-1 text-xs text-white/55">
              Add <span className="font-mono">/public/videos/demo.mp4</span> to enable the on-page demo.
            </div>
          </div>
        </div>
      )}

      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
    </div>
  );

  return (
    <>
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={() => isInteractive && !broken && setOpen(true)}
        role={isInteractive && !broken ? "button" : undefined}
        tabIndex={isInteractive && !broken ? 0 : -1}
        onKeyDown={(e) => {
          if (!isInteractive || broken) return;
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className={cn("group relative", isInteractive && !broken ? "cursor-zoom-in" : "", className)}
      >
        {/* hero glow behind */}
        {isInteractive && !broken && (
          <div className="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(101,93,255,0.40),transparent_55%)]" />
        )}

        {/* Tilt layer (keeps wrapper math stable, avoids jitter) */}
        <div
          ref={tiltRef}
          style={
            isInteractive
              ? ({
                  transform:
                    "perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateZ(0)",
                  willChange: "transform",
                } as const)
              : undefined
          }
        >
          {/* macOS-ish frame */}
          {chrome ? (
            <div className="relative overflow-hidden rounded-[22px] border border-white/12 bg-black/35 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/30 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
              <div className="ml-3 text-[11px] font-semibold text-white/55">CutSwitch demo</div>
              <div className="ml-auto text-[11px] text-white/35">loop</div>
            </div>

            <div className="p-3 sm:p-4">
              {CardInner}
            </div>

            {/* hover instruction */}
            {isInteractive && !broken && (
              <div className="pointer-events-none absolute bottom-4 right-4 grid place-items-center rounded-full border border-white/15 bg-black/35 px-3 py-2 text-[11px] font-semibold text-white/75 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                Click to expand
              </div>
            )}
            </div>
          ) : (
            <>
              {CardInner}
              {isInteractive && !broken && (
                <div className="pointer-events-none absolute bottom-4 right-4 grid place-items-center rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-semibold text-white/75 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Click to expand
                </div>
              )}
            </>
          )}
        </div>

        {/* glass highlight */}
        {isInteractive && !broken && (
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_40%)]" />
        )}
      </div>

      {/* Lightbox / modal */}
      {open && !broken && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
            <button
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur-md hover:bg-black/55"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <video
              className="h-full w-full"
              src="/videos/demo.mp4"
              autoPlay
              loop
              muted
              playsInline
              controls
            />
          </div>
        </div>
      )}
    </>
  );
}
