export const runtime = "nodejs";

import { getIpHash } from "@/lib/request";
import { NO_STORE_HEADERS, safeRateLimit } from "@/lib/security";

const MAX_REPORT_BYTES = 16 * 1024;

function sanitizeReport(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value
      .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
      .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]")
      .slice(0, 500);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeReport(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      output[key.slice(0, 100)] = /token|secret|password|cookie|authorization/i.test(key)
        ? "[redacted]"
        : sanitizeReport(entry, depth + 1);
    }
    return output;
  }
  return null;
}

export async function POST(req: Request) {
  const ipHash = getIpHash(req);
  const rl = await safeRateLimit(`rl:csp_report:ip:${ipHash}`, 120, 60 * 60, "csp_report");
  if (!rl.allowed) {
    return Response.json(
      { ok: false, error: "Too many reports." },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(Math.max(1, rl.reset_seconds ?? 60)),
        },
      }
    );
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
    return Response.json({ ok: false, error: "Report too large." }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REPORT_BYTES) {
    return Response.json({ ok: false, error: "Report too large." }, { status: 413, headers: NO_STORE_HEADERS });
  }

  let report: unknown = text.slice(0, 1000);
  try {
    report = sanitizeReport(JSON.parse(text));
  } catch {
    // Some browsers/proxies may send unusual report bodies. Keep only a short, non-sensitive preview.
  }

  console.warn("[security:csp-report]", { ipHash, report });
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
