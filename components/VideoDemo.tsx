"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type VideoDemoProps = {
  className?: string;
  /** Frame.io-ish: hover glow + subtle parallax + click to expand */
  interactive?: boolean;
};

export function VideoDemo({ className, interactive = true }: VideoDemoProps) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const transformStyle = useMemo(() => {
    if (!interactive) return undefined;
    // keep it subtle: a gentle "card" tilt on hover
    return {
      transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(0)`,
    } as const;
  }, [interactive, tilt.rx, tilt.ry]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const onMove = (e: any) => {
    if (!interactive) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height; // 0..1
    const ry = (px - 0.5) * 5; // degrees
    const rx = (0.5 - py) * 3.5;
    setTilt({ rx, ry });
  };

  const onLeave = () => {
    if (!interactive) return;
    setTilt({ rx: 0, ry: 0 });
  };

  return (
    <>
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={() => interactive && !broken && setOpen(true)}
        role={interactive && !broken ? "button" : undefined}
        tabIndex={interactive && !broken ? 0 : -1}
        onKeyDown={(e) => {
          if (!interactive || broken) return;
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5",
          interactive && !broken ? "cursor-zoom-in" : "",
          className
        )}
        style={transformStyle}
      >
        {!broken ? (
          <video
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

        {/* Frame.io-ish glow + glass sheen */}
        <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
        {interactive && !broken && (
          <>
            <div className="pointer-events-none absolute -inset-24 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(101,93,255,0.35),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),transparent_40%)]" />
            <div className="pointer-events-none absolute bottom-4 right-4 grid place-items-center rounded-full border border-white/15 bg-black/30 px-3 py-2 text-[11px] font-semibold text-white/75 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Click to expand
            </div>
          </>
        )}
      </div>

      {/* Lightbox / modal */}
      {open && !broken && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            // close only if you click the backdrop
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
