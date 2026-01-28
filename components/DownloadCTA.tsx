"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

type DownloadCTAProps = {
  /**
   * Defaults to /pricing, since most visitors want to start the free trial.
   * Override if you want to drive directly to /download.
   */
  href?: string;
  label?: string;
  className?: string;
};

export function DownloadCTA({
  href = "/pricing",
  label = "Start Free Trial",
  className,
}: DownloadCTAProps) {
  return (
    <Link href={href} className={cn("btn btn-primary", className)}>
      {label}
    </Link>
  );
}
