import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const envFile = readFileSync(path, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

function safeHost(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

console.log("Rate-limit store check");
console.log(
  JSON.stringify(
    {
      provider: "@vercel/kv / Upstash REST",
      KV_REST_API_URL: Boolean(url),
      KV_REST_API_TOKEN: Boolean(token),
      host: safeHost(url),
    },
    null,
    2
  )
);

if (!url || !token) {
  console.error("Missing KV_REST_API_URL or KV_REST_API_TOKEN.");
  process.exit(1);
}

const key = `rl-health:${Date.now()}`;

async function upstash(path: string) {
  const res = await fetch(`${url}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }

  return {
    status: res.status,
    ok: res.ok,
    bodyShape: Array.isArray(body) ? "array" : typeof body,
  };
}

try {
  const ping = await upstash("ping");
  const incr = await upstash(`incr/${encodeURIComponent(key)}`);
  const expire = await upstash(`expire/${encodeURIComponent(key)}/60`);

  console.log(JSON.stringify({ ping, incr, expire }, null, 2));

  if (!ping.ok || !incr.ok || !expire.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "unavailable",
        message: error instanceof Error ? error.message : "unknown",
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
