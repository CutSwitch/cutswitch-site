"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
};

export function SmartImage({ src, alt, className, fallbackLabel }: Props) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5",
          className
        )}
        aria-label={alt}
      >
        <div className="absolute inset-0 bg-card-sheen opacity-70" />
        <div className="relative px-4 py-10 text-center">
          <div className="text-sm font-semibold text-white/80">{fallbackLabel || "Screenshot"}</div>
          <div className="mt-1 text-xs text-white/55">Add {src} to /public to replace this placeholder.</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("rounded-2xl border border-white/10 bg-white/5", className)}
      onError={() => setBroken(true)}
      loading="lazy"
    />
  );
}
