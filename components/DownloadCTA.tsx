import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DownloadCTAProps = {
  /**
   * Simple button mode (used in the navbar / hero).
   *
   * Note: Some parts of the site may pass a richer prop-set (title/subtitle/etc).
   * To keep builds resilient, this component supports both modes.
   */
  href?: string;
  label?: string;
  className?: string;

  /**
   * Block mode (used by FinalCTA in some versions).
   */
  title?: ReactNode;
  subtitle?: string;
  buttonLabel?: string;
  buttonHref?: string;
  variant?: string;
  align?: string;
  contentClassName?: string;
  backgroundClassName?: string;
  containerClassName?: string;
};

function getButtonClasses(variant?: string) {
  // Keep it simple and compatible with existing CSS utilities.
  // Default = primary.
  if (variant === "outline" || variant === "secondary") {
    return "btn";
  }
  if (variant === "ghost") {
    return "btn btn-ghost";
  }
  return "btn-primary";
}

/**
 * A small CTA component that supports two usages:
 * 1) A single button (default)
 * 2) A full CTA block (when `title`/`subtitle` are provided)
 */
export function DownloadCTA({
  href,
  label,
  className,
  title,
  subtitle,
  buttonLabel,
  buttonHref,
  variant,
  align,
  contentClassName,
  backgroundClassName,
  containerClassName,
}: DownloadCTAProps) {
  const finalHref = buttonHref ?? href ?? "/download";
  const finalLabel = buttonLabel ?? label ?? "Download";

  const isBlockMode = Boolean(title || subtitle || contentClassName || backgroundClassName || containerClassName);
  const alignMode = align === "left" ? "left" : "center";

  if (isBlockMode) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-black/20 p-8 backdrop-blur-xl",
          backgroundClassName,
          containerClassName,
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-4",
            alignMode === "left" ? "items-start text-left" : "items-center text-center",
            contentClassName,
          )}
        >
          {title ? (
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
          ) : null}

          {subtitle ? <p className="max-w-prose text-sm text-white/70">{subtitle}</p> : null}

          <a href={finalHref} className={cn(getButtonClasses(variant), className)}>
            {finalLabel}
          </a>
        </div>
      </div>
    );
  }

  return (
    <a href={finalHref} className={cn(getButtonClasses(variant), className)}>
      {finalLabel}
    </a>
  );
}
