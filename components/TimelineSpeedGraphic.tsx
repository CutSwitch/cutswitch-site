"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/**
 * Frame.io-ish moving "orb stack" graphic.
 * - Subtle float animation (CSS)
 * - Desktop parallax follows pointer (very light)
 */
export function TimelineSpeedGraphic({ className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only do pointer parallax on devices that actually have a mouse.
    const m = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!m?.matches) return;

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    let rect = el.getBoundingClientRect();
    const updateRect = () => {
      rect = el.getBoundingClientRect();
    };
    window.addEventListener("resize", updateRect);

    let tx = 0;
    let ty = 0;
    let tmx = 60;
    let tmy = 45;

    let cx = 0;
    let cy = 0;
    let cmx = 60;
    let cmy = 45;

    let raf = 0;

    const commit = () => {
      // gentle inertia
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      cmx += (tmx - cmx) * 0.18;
      cmy += (tmy - cmy) * 0.18;

      el.style.setProperty("--ox", `${cx.toFixed(2)}px`);
      el.style.setProperty("--oy", `${cy.toFixed(2)}px`);
      el.style.setProperty("--gx", `${cmx.toFixed(2)}%`);
      el.style.setProperty("--gy", `${cmy.toFixed(2)}%`);

      raf = requestAnimationFrame(commit);
    };

    const setTargets = (clientX: number, clientY: number) => {
      const px = clamp((clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((clientY - rect.top) / rect.height, 0, 1);

      tmx = px * 100;
      tmy = py * 100;

      // tiny parallax translation
      tx = (px - 0.5) * 60;
      ty = (py - 0.5) * 44;
    };

    const onMove = (e: PointerEvent) => setTargets(e.clientX, e.clientY);
    const onLeave = () => {
      tx = 0;
      ty = 0;
      tmx = 60;
      tmy = 45;
    };

    // initialize
    setTargets(rect.left + rect.width * 0.6, rect.top + rect.height * 0.45);
    raf = requestAnimationFrame(commit);

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      window.removeEventListener("resize", updateRect);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("timeline-orb-graphic", className)}
    >
      <div className="timeline-orb-cursor" />

      {/* The stack */}
      <div className="timeline-orb timeline-orb-a" />
      <div className="timeline-orb timeline-orb-b" />
      <div className="timeline-orb timeline-orb-c" />

      {/* glass + grain */}
      <div className="timeline-orb-sheen" />
      <div className="timeline-orb-noise" />
      <div className="timeline-orb-vignette" />
    </div>
  );
}
