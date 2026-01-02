"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

type NavItem = { href: string; label: string; glow?: boolean };

const NAV: NavItem[] = [
  { href: "/pricing", label: "Pricing", glow: true },
  { href: "/download", label: "Download" },
  { href: "/support", label: "Support", glow: true },
  { href: "/affiliates", label: "Affiliates" },
  ];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const active = useMemo(() => pathname ?? "/", [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0E1020]/80 backdrop-blur">
      <div className="container-edge flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo />
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm transition",
                  isActive ? "text-white" : "text-white/70 hover:text-white",
                  item.glow && !isActive ? "hover:shadow-[0_0_0_1px_rgba(101,93,255,0.25)]" : ""
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute inset-x-2 -bottom-[9px] h-[2px] rounded-full bg-brand/80" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link className="btn btn-ghost" href="/demo">
            Watch demo
          </Link>
          <Link className="btn btn-primary" href="/download">
            Download
            <span className="text-white/80">→</span>
          </Link>
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0E1020]/90 backdrop-blur">
          <div className="container-edge py-3">
            <div className="grid gap-1">
              {NAV.map((item) => {
                const isActive = active === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-xl px-3 py-3 text-sm",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/75 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link className="btn btn-ghost w-full" href="/demo">
                  Watch demo
                </Link>
                <Link className="btn btn-primary w-full" href="/download">
                  Download
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
