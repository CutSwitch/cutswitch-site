import { cn } from "@/lib/utils";

export type FaqItem = {
  q: string;
  a: string;
};

export type FaqProps = {
  title?: string;
  subtitle?: string;
  items: FaqItem[];
  className?: string;
};

export function Faq({ title, subtitle, items, className }: FaqProps) {
  return (
    <section className={cn("space-y-6", className)}>
      {(title || subtitle) && (
        <header className="space-y-2">
          {title ? (
            <h2 className="text-2xl font-semibold tracking-tight text-white/90">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="text-sm leading-relaxed text-white/65">{subtitle}</p>
          ) : null}
        </header>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-white/90">
              <div className="flex items-center justify-between gap-4">
                <span>{item.q}</span>
                <span className="text-white/40 transition group-open:rotate-45">
                  +
                </span>
              </div>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}