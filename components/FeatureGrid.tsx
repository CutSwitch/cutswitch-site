import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Feature = {
  icon?: ReactNode;
  /** Optional visual media shown above the title (e.g. animated preview). */
  mediaSrc?: string;
  mediaAlt?: string;
  title: string;
  description: string;
};

export type FeatureGridProps = {
  /** Optional section heading shown above the grid. */
  title?: string;
  /** Optional section subheading shown below the title. */
  subtitle?: string;
  features: Feature[];
  className?: string;
};

export function FeatureGrid({
  title,
  subtitle,
  features,
  className,
}: FeatureGridProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {(title || subtitle) && (
        <div className="space-y-2">
          {title ? (
            <h2 className="text-2xl font-semibold tracking-tight text-white/90">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm leading-relaxed text-white/65">{subtitle}</p>
          ) : null}
        </div>
      )}

      {/*
        Desktop previews felt a little cramped at 3-up.
        Keep the grid 2-up on larger screens so the media tiles stay big and readable.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_70px_rgba(0,0,0,0.35)] transition-[transform,border-color,box-shadow,background-color] duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_28px_110px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
            <div className="relative">
              {f.mediaSrc ? (
                <div className="relative mb-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-[0_20px_70px_rgba(0,0,0,0.55)] ring-1 ring-white/5 transition-transform duration-300 ease-out group-hover:scale-[1.01]">
                  <div className="aspect-[16/9]">
                    <img
                      src={f.mediaSrc}
                      alt={f.mediaAlt ?? f.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  </div>

                  {/* subtle hover glow */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_30%_20%,rgba(101,93,255,0.35),transparent_60%)]" />
                </div>
              ) : f.icon ? (
                <div className="mb-4 flex h-[110px] items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <span className="text-brand [&_svg]:h-9 [&_svg]:w-9">{f.icon}</span>
                </div>
              ) : null}
              <div className="text-sm font-semibold text-white/90">
                {f.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}