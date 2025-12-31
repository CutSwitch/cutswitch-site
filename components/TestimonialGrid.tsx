import { cn } from "@/lib/utils";

export type Testimonial = {
  quote: string;
  name: string;
  title: string;
};

export function TestimonialGrid({
  items,
  className,
}: {
  items: Testimonial[];
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {items.map((t) => (
        <div
          key={t.name}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-0.5 hover:border-white/20"
        >
          <div className="pointer-events-none absolute inset-0 bg-card-sheen opacity-40" />
          <div className="relative">
            <p className="text-sm leading-relaxed text-white/75">“{t.quote}”</p>
            <div className="mt-5 text-sm font-semibold text-white/90">{t.name}</div>
            <div className="text-xs text-white/55">{t.title}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
