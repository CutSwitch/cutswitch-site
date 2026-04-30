"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string | null | undefined; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  return (
    <button
      type="button"
      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
