"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const THEME_KEY = "cutswitch-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    const initial =
      stored === "light" || stored === "dark" ? stored : getSystemTheme();
    const root = document.documentElement;
    if (initial === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }
    setTheme(initial);
  }, []);

  function applyTheme(next: Theme) {
    const root = document.documentElement;
    if (next === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore storage failures
    }
    setTheme(next);
  }

  return (
    <div
      suppressHydrationWarning
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1",
        className
      )}
    >
      <button
        type="button"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        aria-label="Activate light mode"
        title="Light mode"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          theme === "light"
            ? "bg-white/20 text-white shadow-sm"
            : "text-white/60 hover:text-white"
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        aria-label="Activate dark mode"
        title="Dark mode"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
          theme === "dark"
            ? "bg-white/20 text-white shadow-sm"
            : "text-white/60 hover:text-white"
        )}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
