export default function AdminLoading() {
  return (
    <section className="container-edge py-10 sm:py-14">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="h-4 w-24 rounded-full bg-white/10" />
        <div className="mt-4 h-8 w-72 rounded-full bg-white/10" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </section>
  );
}
