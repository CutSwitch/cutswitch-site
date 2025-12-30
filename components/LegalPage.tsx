import { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="container-edge">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/55">Last updated: {updated}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/70 prose-invert">
          {children}
        </div>
      </div>
    </div>
  );
}
