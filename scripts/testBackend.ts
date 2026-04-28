import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ApiResult = {
  ok: boolean;
  status: number | "NETWORK_ERROR";
  body: unknown;
};

const DEFAULT_BASE_URL = "https://cutswitch-site.vercel.app";

loadDotEnvLocal();

const baseUrl = (process.env.TEST_BACKEND_URL || DEFAULT_BASE_URL).replace(
  /\/$/,
  ""
);
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

let failed = false;

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function markFailed(message: string) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (/access_token|refresh_token|token|password|secret/i.test(key)) {
        return [key, entryValue ? "[present]" : entryValue];
      }

      return [key, redactSecrets(entryValue)];
    })
  );
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function post(url: string, init: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: "POST", ...init });

    return {
      ok: res.ok,
      status: res.status,
      body: await readBody(res),
    };
  } catch (error) {
    return {
      ok: false,
      status: "NETWORK_ERROR",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

function logResult(label: string, result: ApiResult) {
  console.log(`${label} STATUS:`, result.status);

  if (typeof result.body === "string") {
    const body =
      result.body.length > 1200
        ? `${result.body.slice(0, 1200)}\n...[truncated ${
            result.body.length - 1200
          } chars]`
        : result.body;

    console.log(`${label}:`, body);
    return;
  }

  console.log(`${label}:`, JSON.stringify(redactSecrets(result.body), null, 2));
}

if (!email || !password) {
  markFailed("Set TEST_EMAIL and TEST_PASSWORD in .env.local or your shell.");
  process.exitCode = 1;
} else {
  const login = await post(`${baseUrl}/api/app/session`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      deviceName: "Codex Test",
      deviceFingerprint: "codex-test-001",
    }),
  });

  logResult("LOGIN", login);

  const token =
    login.body &&
    typeof login.body === "object" &&
    "access_token" in login.body &&
    typeof login.body.access_token === "string"
      ? login.body.access_token
      : undefined;

  console.log("ACCESS_TOKEN_PRESENT:", Boolean(token));

  if (!login.ok) {
    markFailed("Login request failed.");
  }

  if (!token) {
    markFailed("Login response did not include access_token.");
  } else {
    const usage = await post(`${baseUrl}/api/account/usage`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logResult("USAGE", usage);

    if (!usage.ok) {
      markFailed("Usage request failed.");
    }
  }

  const missingTokenUsage = await post(`${baseUrl}/api/account/usage`, {
    headers: {},
  });

  logResult("USAGE_MISSING_TOKEN", missingTokenUsage);

  if (missingTokenUsage.ok) {
    markFailed("Usage request without Authorization unexpectedly succeeded.");
  }

  process.exitCode = failed ? 1 : 0;
}
