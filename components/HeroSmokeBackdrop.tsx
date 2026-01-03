"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/**
 * Cinematic, Frame.io-ish smoke backdrop.
 * - Uses layered blurred gradients + subtle grain
 * - Parallax follows pointer movement (very light)
 */
export function HeroSmokeBackdrop({ className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const host = (el.closest("[data-hero-parallax]") as HTMLElement | null) ?? el.parentElement;
    if (!host) return;

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    let rect = host.getBoundingClientRect();
    const updateRect = () => {
      rect = host.getBoundingClientRect();
    };
    window.addEventListener("resize", updateRect);

    // Targets (what the pointer wants)
    let tx = 0;
    let ty = 0;
    let tmx = 55;
    let tmy = 35;

    // Current (what the smoke actually is doing) with a little inertia.
    let cx = 0;
    let cy = 0;
    let cmx = 55;
    let cmy = 35;

    let raf = 0;

    const commit = () => {
      // Inertia / smoothing
      cx += (tx - cx) * 0.085;
      cy += (ty - cy) * 0.085;
      cmx += (tmx - cmx) * 0.16;
      cmy += (tmy - cmy) * 0.16;

      // Shared vars (children can parallax off these)
      host.style.setProperty("--px", `${cx}px`);
      host.style.setProperty("--py", `${cy}px`);
      host.style.setProperty("--mx", `${cmx}%`);
      host.style.setProperty("--my", `${cmy}%`);

      // Smoke layers (different depths)
      el.style.setProperty("--smoke-x1", `${cx}px`);
      el.style.setProperty("--smoke-y1", `${cy}px`);
      el.style.setProperty("--smoke-x2", `${cx * 0.72}px`);
      el.style.setProperty("--smoke-y2", `${cy * 0.72}px`);
      el.style.setProperty("--smoke-x3", `${cx * 0.42}px`);
      el.style.setProperty("--smoke-y3", `${cy * 0.42}px`);

      raf = window.requestAnimationFrame(commit);
    };

    const setTargetsFromPoint = (clientX: number, clientY: number) => {
      // Pointer position relative to the hero, not the full window.
      const px = clamp((clientX - rect.left) / rect.width, 0, 1);
      const py = clamp((clientY - rect.top) / rect.height, 0, 1);

      // Cursor-follow glow position (used by a radial gradient)
      tmx = px * 100;
      tmy = py * 100;

      // Parallax translation (bigger than before so you can actually feel it)
      const nx = px - 0.5;
      const ny = py - 0.5;
      tx = nx * 210;
      ty = ny * 160;
    };

    const onPointerMove = (e: PointerEvent) => setTargetsFromPoint(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => setTargetsFromPoint(e.clientX, e.clientY);

    const onLeave = () => {
      // Drift back to a calm, slightly off-center spotlight.
      tx = 0;
      ty = 0;
      tmx = 55;
      tmy = 35;
    };

    // Initialize to the "spotlight" position.
    setTargetsFromPoint(rect.left + rect.width * 0.55, rect.top + rect.height * 0.35);
    raf = window.requestAnimationFrame(commit);

    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("mousemove", onMouseMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    host.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      window.removeEventListener("resize", updateRect);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("mousemove", onMouseMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("hero-smoke pointer-events-none", className)}
    >
      <div className="hero-smoke-cursor" />
      <div className="hero-smoke-blob hero-smoke-blob-a" />
      <div className="hero-smoke-blob hero-smoke-blob-b" />
      <div className="hero-smoke-blob hero-smoke-blob-c" />
      <div className="hero-smoke-noise" />
      <div className="hero-smoke-vignette" />
    </div>
  );
}
