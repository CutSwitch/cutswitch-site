"use client";

import { useEffect } from "react";

/**
 * Writes scroll-related CSS vars to :root.
 *
 * Why this exists:
 * - Enables subtle parallax on background layers (CSS-only).
 * - Avoids React state/render churn (pure DOM writes).
 * - Respects prefers-reduced-motion.
 */
export function ScrollCSSVars() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (reduced?.matches) return;

    const root = document.documentElement;
    let raf = 0;
    let lastY = -1;

    const update = () => {
      raf = 0;
      const y = window.scrollY || window.pageYOffset || 0;
      if (y !== lastY) {
        root.style.setProperty("--scrollY", `${y}px`);
        lastY = y;
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    // Initial write so the first paint has stable values.
    schedule();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
