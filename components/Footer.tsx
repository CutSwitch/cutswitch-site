import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { Logo } from "@/components/Logo";

const nav1 = [
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/support", label: "Support" },
  { href: "/affiliates", label: "Affiliates" },
  { href: "/press", label: "Press" },
];

const nav2 = [  { href: "/account", label: "Account" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-white/[0.02]">
      <div className="container-edge py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo className="-ml-2" />
            <p className="mt-4 max-w-md text-sm text-white/65">
              CutSwitch auto-switches Final Cut Pro multicam edits by who’s speaking.
              It’s local-first, fast, and designed to give you a clean first cut you can refine in Final Cut.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a className="chip" href={`mailto:${siteConfig.emails.support}`}>
                {siteConfig.emails.support}
              </a>
              <a className="chip" href={`mailto:${siteConfig.emails.feedback}`}>
                {siteConfig.emails.feedback}
              </a>
              <a className="chip" href={`mailto:${siteConfig.emails.affiliate}`}>
                {siteConfig.emails.affiliate}
              </a>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white/90">Product</div>
            <ul className="mt-4 space-y-3 text-sm">
              {nav1.map((l) => (
                <li key={l.href}>
                  <Link className="link" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-white/90">Company</div>
            <ul className="mt-4 space-y-3 text-sm">
              {nav2.map((l) => (
                <li key={l.href}>
                  <Link className="link" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/50">
            © {year} {siteConfig.name}. All rights reserved.
          </div>

          <div className="text-xs text-white/50">
            Built for editors. Local-first. Fast by design.
          </div>
        </div>
      </div>
    </footer>
  );
}
