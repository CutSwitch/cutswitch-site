import { cn } from "@/lib/utils";

export type FaqItem = {
  q: string;
  a: string;
};

export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-2xl border border-white/10 bg-white/5 px-5 py-4 transition hover:border-white/20"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/90">
            <div className="flex items-center justify-between gap-3">
              <span>{item.q}</span>
              <span className="text-white/40 transition group-open:rotate-45">+</span>
            </div>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-white/65">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
