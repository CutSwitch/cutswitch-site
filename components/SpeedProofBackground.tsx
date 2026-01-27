"use client";

import { useEffect, useRef } from "react";

type Props = {
  className?: string;
};

/**
 * Full-bleed animated backdrop for the "minutes not hours" speed-proof section.
 *
 * Design intent:
 * - feels embedded in the section background (not a boxed card)
 * - slow, calm, continuous loop (no snappy UI effects)
 * - subtle pointer parallax on desktop only
 * - MP4 is the primary media; GIF is a reduced-motion fallback
 */
export function SpeedProofBackground({ className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const target = useRef({ x: 0.5, y: 0.4 });
  const current = useRef({ x: 0.5, y: 0.4 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!media.matches || reduced.matches) return;

    const updateVars = () => {
      // Inertia smoothing: calm, premium motion.
      current.current.x += (target.current.x - current.current.x) * 0.06;
      current.current.y += (target.current.y - current.current.y) * 0.06;

      const xPct = Math.max(0, Math.min(1, current.current.x));
      const yPct = Math.max(0, Math.min(1, current.current.y));

      el.style.setProperty("--spx", `${(xPct * 100).toFixed(2)}%`);
      el.style.setProperty("--spy", `${(yPct * 100).toFixed(2)}%`);

      rafRef.current = window.requestAnimationFrame(updateVars);
    };

    const onMove = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      target.current.x = x;
      target.current.y = y;
    };

    const onLeave = () => {
      // Return gently to a default composition.
      target.current.x = 0.65;
      target.current.y = 0.38;
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("mouseleave", onLeave);

    rafRef.current = window.requestAnimationFrame(updateVars);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={[
        "speedproof-bg pointer-events-none absolute inset-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Animated media layer (MP4; GIF fallback for reduced-motion) */}
      <div className="speedproof-bg__media">
        <video
          className="speedproof-bg__video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
        >
          <source src="/illust/speedproof-bg.mp4" type="video/mp4" />
        </video>

        {/* Reduced-motion fallback (or if video fails to load). */}
        <div className="speedproof-bg__gif" />
      </div>

      {/* Brand tint so the palette is consistent with CutSwitch */}
      <div className="speedproof-bg__tint" />

      {/* Gentle light response halo so the art feels anchored into the environment. */}
      <div className="speedproof-bg__halo" />

      {/* Frosted diffusion + slow internal gradient drift. */}
      <div className="speedproof-bg__diffusion" />

      {/* Edge refraction (very subtle). */}
      <div className="speedproof-bg__edge" />
    </div>
  );
}
