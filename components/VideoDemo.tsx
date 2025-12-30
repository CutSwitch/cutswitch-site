"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function VideoDemo({ className }: { className?: string }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-white/5", className)}>
      {!broken ? (
        <video
          className="h-full w-full"
          controls
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
        >
          <source src="/videos/demo.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="grid min-h-[280px] place-items-center p-10 text-center">
          <div>
            <div className="text-sm font-semibold text-white/85">Demo video placeholder</div>
            <div className="mt-1 text-xs text-white/55">
              Add /public/videos/demo.mp4 to enable the on-page demo.
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
    </div>
  );
}
