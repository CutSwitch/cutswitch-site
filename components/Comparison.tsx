export function Comparison() {
  const manual = [
    "Hunt through menus and dialog boxes.",
    "Repeat the same trim and split actions dozens of times per day.",
    "Lose flow state to tiny UI chores.",
    "Inconsistent results across projects.",
    "Higher chance of export mistakes under pressure.",
  ];

  const cutswitch = [
    "Keyboard-first actions that feel instant.",
    "Repeatable automation for the boring parts.",
    "Stay in the timeline, stay in your head.",
    "Consistent output across edits and teams.",
    "Guardrails that reduce "oops" exports.",
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold text-white/90">Manual editing</div>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {manual.map((x) => (
            <li key={x} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/35" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-brand/30 bg-white/5 p-6 shadow-glow">
        <div className="text-sm font-semibold text-white/90">
          CutSwitch <span className="text-brand-highlight">(the faster way)</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {cutswitch.map((x) => (
            <li key={x} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-brand/80" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
