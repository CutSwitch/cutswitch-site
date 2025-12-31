import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type Step = {
  icon?: ReactNode;
  title: string;
  description: string;
};

export type HowItWorksProps = {
  /** Optional section heading shown above the steps grid. */
  title?: string;
  /** Optional section subheading shown below the title. */
  subtitle?: string;
  steps: Step[];
  className?: string;
};

export function HowItWorks({ title, subtitle, steps, className }: HowItWorksProps) {
  return (
    <section className={cn("space-y-6", className)}>
      {(title || subtitle) && (
        <header className="space-y-2">
          {title ? (
            <h2 className="text-2xl font-semibold tracking-tight text-white/90">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm leading-relaxed text-white/65">{subtitle}</p>
          ) : null}
        </header>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, idx) => (
          <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="chip w-fit">
                <span className="text-brand-highlight">Step {idx + 1}</span>
              </div>

              {s.icon ? (
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                  <span className="text-brand">{s.icon}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 text-sm font-semibold text-white/90">{s.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-white/65">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}