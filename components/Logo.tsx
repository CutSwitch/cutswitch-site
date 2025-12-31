"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** If true, render the mark-only logo (no wordmark). */
  markOnly?: boolean;
};

export function Logo({ className, markOnly }: Props) {
  const src = markOnly ? "/logo-mark.png" : "/logo-lockup.png";
  const width = markOnly ? 28 : 140;
  const height = 28;

  return (
    <Link href="/" className={cn("flex items-center gap-3", className)} aria-label="CutSwitch home">
      <Image
        src={src}
        alt="CutSwitch logo"
        width={width}
        height={height}
        priority
        className={cn("h-7 w-auto", markOnly ? "w-7" : "")}
      />
    </Link>
  );
}
