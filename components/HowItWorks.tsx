import { cn } from "@/lib/utils";

export type Step = {
  title: string;
  description: string;
};

export function HowItWorks({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {steps.map((s, idx) => (
        <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="chip w-fit">
            <span className="text-brand-highlight">Step {idx + 1}</span>
          </div>
          <div className="mt-4 text-sm font-semibold text-white/90">{s.title}</div>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{s.description}</p>
        </div>
      ))}
    </div>
  );
}
