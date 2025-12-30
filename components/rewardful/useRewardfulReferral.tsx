"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Rewardful?: { referral?: string };
    rewardful?: (...args: any[]) => void;
  }
}

export function useRewardfulReferral(): string | null {
  const [referral, setReferral] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const read = () => {
      const r = window.Rewardful?.referral;
      if (alive) setReferral(typeof r === "string" && r.length > 0 ? r : null);
    };

    read();

    // Rewardful's script sets window.Rewardful asynchronously.
    const t = setInterval(read, 300);
    const timeout = setTimeout(() => clearInterval(t), 4000);

    // If Rewardful's JS API is available, read when it says it's ready.
    try {
      window.rewardful?.("ready", read);
    } catch {
      // ignore
    }

    return () => {
      alive = false;
      clearInterval(t);
      clearTimeout(timeout);
    };
  }, []);

  return referral;
}
