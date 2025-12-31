import { cn } from "@/lib/utils";

export type Testimonial = {
  quote: string;
  name: string;
  title: string;
};

export type TestimonialGridProps = {
  title?: string;
  subtitle?: string;
  items: Testimonial[];
  className?: string;
};

export function TestimonialGrid({
  title,
  subtitle,
  items,
  className,
}: TestimonialGridProps) {
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

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((t) => (
          <figure
            key={`${t.name}-${t.title}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <blockquote className="text-sm leading-relaxed text-white/80">
              “{t.quote}”
            </blockquote>

            <figcaption className="mt-4 text-sm">
              <div className="font-semibold text-white/90">{t.name}</div>
              <div className="text-white/60">{t.title}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}