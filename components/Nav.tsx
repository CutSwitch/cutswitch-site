"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavAuth } from "@/components/auth/NavAuth";

type NavItem = { href: string; label: string; glow?: boolean };

const NAV: NavItem[] = [
  { href: "/pricing", label: "Pricing" },
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
        <div className="flex items-center gap-6 md:gap-6">
          <Logo />

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
        </div>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link href="/demo" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white">
            Watch Demo
          </Link>
          <Link href="/start?source=header" className="btn btn-primary rounded-full px-5 py-2 text-sm">
            Start Free Trial
          </Link>
          <NavAuth />
        </div>

        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
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
              <Link href="/demo" className="rounded-xl px-3 py-3 text-sm text-white/75 hover:bg-white/5 hover:text-white">
                Watch Demo
              </Link>
              <Link href="/start?source=header" className="btn btn-primary mt-2 justify-center rounded-full">
                Start Free Trial
              </Link>
              <div className="pt-2">
                <NavAuth mobile />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
