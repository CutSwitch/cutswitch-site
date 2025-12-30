"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

type Props = {
  className?: string;
  markOnly?: boolean;
};

export function Logo({ className, markOnly }: Props) {
  const [broken, setBroken] = useState(false);

  const sizeCls = useMemo(() => "h-7 w-7", []);

  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-3 rounded-xl px-2 py-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-0",
        className
      )}
      aria-label={`${siteConfig.name} home`}
    >
      {!broken ? (
        <img
          src="/logo.svg"
          alt={`${siteConfig.name} logo`}
          className={cn(
            sizeCls,
            "rounded-md",
            "opacity-95 group-hover:opacity-100 transition"
          )}
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className={cn(
            sizeCls,
            "rounded-md border border-white/10 bg-white/5",
            "grid place-items-center text-xs font-semibold text-brand-highlight"
          )}
        >
          CS
        </div>
      )}

      {!markOnly && (
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">
            {siteConfig.name}
            <span className="text-brand-highlight">.</span>
          </div>
          <div className="text-xs text-white/55">{siteConfig.tagline}</div>
        </div>
      )}
    </Link>
  );
}
