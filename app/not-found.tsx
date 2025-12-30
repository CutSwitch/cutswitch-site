import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-edge">
      <div className="card p-10 text-center">
        <div className="chip mx-auto w-fit">
          <span className="text-brand-highlight">404</span>
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">This page got cut.</h1>
        <p className="mt-3 text-sm text-white/65">
          The link might be wrong, or the page moved. Either way, the timeline continues.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link className="btn btn-primary" href="/">
            Back to home <span className="text-white/80">→</span>
          </Link>
          <Link className="btn btn-secondary" href="/support">
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}
