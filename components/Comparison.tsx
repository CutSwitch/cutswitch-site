import { cn } from "@/lib/utils";

export type ComparisonRow = {
  feature: string;
  manual: string;
  cutswitch: string;
};

export type ComparisonProps = {
  /** Optional section heading shown above the comparison table. */
  title?: string;
  /** Optional section subheading shown below the title. */
  subtitle?: string;
  rows: ComparisonRow[];
  className?: string;
};

export function Comparison({ title, subtitle, rows, className }: ComparisonProps) {
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

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
          <div className="border-b border-white/10 bg-white/5 p-4 text-xs font-semibold uppercase tracking-wide text-white/60 md:border-b-0 md:border-r md:p-5">
            Feature
          </div>
          <div className="border-b border-white/10 bg-white/5 p-4 text-xs font-semibold uppercase tracking-wide text-white/60 md:border-b-0 md:border-r md:p-5">
            Manual
          </div>
          <div className="border-b border-white/10 bg-white/5 p-4 text-xs font-semibold uppercase tracking-wide text-white/60 md:border-b-0 md:p-5">
            CutSwitch
          </div>

          {rows.map((r) => (
            <div key={r.feature} className="contents">
              <div className="border-t border-white/10 p-4 text-sm font-semibold text-white/85 md:border-r md:p-5">
                {r.feature}
              </div>
              <div className="border-t border-white/10 p-4 text-sm text-white/70 md:border-r md:p-5">
                {r.manual}
              </div>
              <div className="border-t border-white/10 p-4 text-sm text-white/70 md:p-5">
                {r.cutswitch}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}