import Link from "next/link";

export function AnnouncementBar() {
  return (
    <div className="border-b border-white/10 bg-white/5">
      <div className="container-edge flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-white/70">
          <span className="chip">
            Support:{" "}
            <Link className="underline decoration-white/20 hover:decoration-white/60" href="/support">
              contact form
            </Link>
          </span>
          <span className="hidden sm:inline text-white/30">|</span>
          <span className="chip">
            Affiliates:{" "}
            <Link className="underline decoration-white/20 hover:decoration-white/60" href="/affiliates">
              apply to earn recurring commissions
            </Link>
          </span>
        </div>

        <div className="flex items-center gap-2 text-white/60">
          <Link className="link" href="/download">
            Download
          </Link>
          <span className="text-white/25">/</span>
          <Link className="link" href="/pricing">
            Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
