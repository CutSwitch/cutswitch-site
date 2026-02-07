import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./seamless-bg.css";
import { getBaseUrl } from "@/lib/env";
import { siteConfig } from "@/lib/site";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ScrollCSSVars } from "@/components/ScrollCSSVars";

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${siteConfig.name} | ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    url: baseUrl,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  alternates: {
    canonical: baseUrl,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const rewardfulApiKey = process.env.NEXT_PUBLIC_REWARDFUL_API_KEY;
  const themeScript = `
    (function() {
      try {
        var stored = localStorage.getItem('cutswitch-theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
        if (theme === 'light') {
          document.documentElement.classList.add('theme-light');
        } else {
          document.documentElement.classList.remove('theme-light');
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg)] relative isolate text-[var(--fg)] antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <ScrollCSSVars />
        <div className="site-bg" aria-hidden="true" />

        {rewardfulApiKey ? (
          <>
            <Script id="rewardful-init" strategy="beforeInteractive">
              {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
            </Script>
            <Script
              id="rewardful-script"
              strategy="afterInteractive"
              src="https://r.wdfl.co/rw.js"
              data-rewardful={rewardfulApiKey}
            />
          </>
        ) : null}

        <Nav />

        <main className="py-10">{children}</main>

        <Footer />
      </body>
    </html>
  );
}
