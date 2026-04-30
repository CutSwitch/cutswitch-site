"use client";

import { cn } from "@/lib/utils";

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "link text-left opacity-100 transition-opacity group-hover/footer-nav:opacity-20 hover:!opacity-100 hover:!text-white focus-visible:!opacity-100 focus-visible:!text-white hover:drop-shadow-[0_0_16px_rgba(185,192,255,0.55)]",
        className
      )}
      onClick={() => window.dispatchEvent(new Event("cutswitch:open-cookie-settings"))}
    >
      Cookie settings
    </button>
  );
}
