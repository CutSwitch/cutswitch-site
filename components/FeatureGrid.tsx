import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Feature = {
  icon?: ReactNode;
  title: string;
  description: string;
};

export function FeatureGrid({
  features,
  className,
}: {
  features: Feature[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {features.map((f) => (
        <div
          key={f.title}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:border-white/20"
        >
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
          <div className="relative">
            {f.icon ? (
              <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <span className="text-brand">{f.icon}</span>
              </div>
            ) : null}
            <div className="text-sm font-semibold text-white/90">{f.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{f.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
