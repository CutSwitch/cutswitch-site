import Link from "next/link";

import { siteConfig } from "@/lib/site";
import { Logo } from "@/components/Logo";

type NavItem = { href: string; label: string };

const product: NavItem[] = [
  { href: "/pricing", label: "Plans & Pricing" },
  { href: "/download", label: "Download" },
  { href: "/demo", label: "Demo" },
  { href: "/affiliates", label: "Affiliates" },
];

const resources: NavItem[] = [
  { href: "/support", label: "Help Center" },
  { href: "/press", label: "Press" },
  { href: "/account", label: "Account" },
];

const legal: NavItem[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/security", label: "Security" },
  { href: "/affiliate-terms", label: "Affiliate Terms" },
];

const getStarted: NavItem[] = [
  { href: "/download", label: "Download beta" },
  { href: "/pricing", label: "Choose a plan" },
  { href: "/account", label: "Manage subscription" },
  { href: "/support", label: "Contact support" },
];

function FooterLinks({ items }: { items: NavItem[] }) {
  return (
    <ul className="mt-4 space-y-3 text-sm">
      {items.map((l) => (
        <li key={l.href}>
          <Link
            className="link opacity-100 group-hover/footer-nav:opacity-40 hover:opacity-100 focus-visible:opacity-100"
            href={l.href}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-white/[0.02]">
      <div className="container-edge py-14">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2">
            <Logo className="-ml-2" />
            <p className="mt-4 max-w-md text-sm text-white/65">
              CutSwitch auto-switches Final Cut Pro multicam edits by who’s speaking. Local-first, fast, and designed
              to give you a clean first cut you can refine in Final Cut.
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

          {/*
            Hover behavior: when you move across footer links, everything gently dims except the one you're on.
            (WhisperAI-style readability, but in dark mode.)
          */}
          <div className="group/footer-nav md:col-span-4 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm font-semibold text-white/90">Product</div>
              <FooterLinks items={product} />
            </div>

            <div>
              <div className="text-sm font-semibold text-white/90">Resources</div>
              <FooterLinks items={resources} />
            </div>

            <div>
              <div className="text-sm font-semibold text-white/90">Legal</div>
              <FooterLinks items={legal} />
            </div>

            <div>
              <div className="text-sm font-semibold text-white/90">Get Started</div>
              <FooterLinks items={getStarted} />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/50">© {year} {siteConfig.name}. All rights reserved.</div>
          <div className="text-xs text-white/50">Built for editors. Local-first. Fast by design.</div>
        </div>
      </div>
    </footer>
  );
}
