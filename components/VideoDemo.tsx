"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [canHover, setCanHover] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // iOS/Safari nuance: autoplay is more reliable when we only apply
  // transforms/hover interactions on devices that actually support hover.
  // (Transformed parents can sometimes interfere with video autoplay on mobile.)
  const isInteractive = interactive && canHover;

  const transformStyle = useMemo(() => {
    if (!isInteractive) return undefined;
    return {
      transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
      willChange: "transform",
    } as const;
  }, [isInteractive, tilt.rx, tilt.ry]);

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
    // Autoplay kick (especially for iOS Safari). We keep it muted + inline.
    const v = videoRef.current;
    if (!v || broken) return;
    try {
      v.muted = true;
      v.autoplay = true;
      v.loop = true;
      // Older iOS Safari can be picky about inline playback.
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.setAttribute("muted", "");
      const p = v.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          // If the browser blocks autoplay, we silently fail and the user can tap.
        });
      }
    } catch {
      // Ignore.
    }
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
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const ry = (px - 0.5) * 5; // subtle
    const rx = (0.5 - py) * 3.5;
    setTilt({ rx, ry });
  };

  const onLeave = () => {
    if (!isInteractive) return;
    setTilt({ rx: 0, ry: 0 });
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
        className={cn(
          "group relative",
          isInteractive && !broken ? "cursor-zoom-in" : "",
          className
        )}
        style={transformStyle}
      >
        {/* hero glow behind */}
        {isInteractive && !broken && (
          <div className="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(101,93,255,0.40),transparent_55%)]" />
        )}

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
