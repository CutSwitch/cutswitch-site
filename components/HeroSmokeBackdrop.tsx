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

    let raf = 0;

    const setVars = (clientX: number, clientY: number) => {
      const nx = clientX / window.innerWidth - 0.5;
      const ny = clientY / window.innerHeight - 0.5;

      const x = nx * 90;
      const y = ny * 70;

      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        el.style.setProperty("--smoke-x1", `${x}px`);
        el.style.setProperty("--smoke-y1", `${y}px`);
        el.style.setProperty("--smoke-x2", `${x * 0.65}px`);
        el.style.setProperty("--smoke-y2", `${y * 0.65}px`);
        el.style.setProperty("--smoke-x3", `${x * 0.35}px`);
        el.style.setProperty("--smoke-y3", `${y * 0.35}px`);
      });
    };

    const onMove = (e: PointerEvent) => {
      setVars(e.clientX, e.clientY);
    };

    // Initialize to a pleasant off-center "spotlight".
    setVars(window.innerWidth * 0.55, window.innerHeight * 0.35);

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("hero-smoke pointer-events-none", className)}
    >
      <div className="hero-smoke-blob hero-smoke-blob-a" />
      <div className="hero-smoke-blob hero-smoke-blob-b" />
      <div className="hero-smoke-blob hero-smoke-blob-c" />
      <div className="hero-smoke-noise" />
      <div className="hero-smoke-vignette" />
    </div>
  );
}
