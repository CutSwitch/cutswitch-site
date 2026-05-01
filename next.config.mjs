/** @type {import('next').NextConfig} */
function originFrom(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = originFrom(process.env.NEXT_PUBLIC_SUPABASE_URL);
const cspHeaderName =
  process.env.CSP_REPORT_ONLY?.trim().toLowerCase() === 'false'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "script-src 'self' 'unsafe-inline' https://r.wdfl.co",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''} https://api.stripe.com https://r.wdfl.co https://app.loops.so`,
  "frame-src https://checkout.stripe.com https://js.stripe.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/security/csp-report",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  {
    key: cspHeaderName,
    value: csp,
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Safe on Vercel (HTTPS). Browsers ignore on localhost.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
];

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/admin',
        headers: noStoreHeaders,
      },
      {
        source: '/admin/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/admin/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/app/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/account/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/billing/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/feedback',
        headers: noStoreHeaders,
      },
      {
        source: '/api/product-events',
        headers: noStoreHeaders,
      },
      {
        source: '/api/transcripts/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/license/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/checkout/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/trial/:path*',
        headers: noStoreHeaders,
      },
      {
        source: '/api/security/:path*',
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
