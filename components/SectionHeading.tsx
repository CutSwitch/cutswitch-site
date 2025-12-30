import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function SectionHeading({ eyebrow, title, subtitle, className }: Props) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <div className="chip mb-3 w-fit">
          <span className="text-brand-highlight">{eyebrow}</span>
        </div>
      )}
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm leading-relaxed text-white/65">{subtitle}</p>}
    </div>
  );
}
