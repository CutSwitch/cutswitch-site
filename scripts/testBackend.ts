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
const checkoutPlanId = process.env.TEST_CHECKOUT_PLAN_ID || "starter";

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
  const unauthCheckout = await post(`${baseUrl}/api/billing/checkout`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: checkoutPlanId }),
  });

  logResult("CHECKOUT_UNAUTHENTICATED", unauthCheckout);

  if (unauthCheckout.status !== 401) {
    markFailed("Unauthenticated checkout did not return 401.");
  }

  const unauthPortal = await post(`${baseUrl}/api/billing/portal`, {
    headers: {},
  });

  logResult("BILLING_PORTAL_UNAUTHENTICATED", unauthPortal);

  if (unauthPortal.status !== 401) {
    markFailed("Unauthenticated billing portal did not return 401.");
  }

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
    const invalidCheckout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: "not_a_plan" }),
    });

    logResult("CHECKOUT_INVALID_PLAN", invalidCheckout);

    if (invalidCheckout.status !== 400) {
      markFailed("Invalid checkout plan did not return 400.");
    }

    const checkout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planId: checkoutPlanId }),
    });

    logResult("CHECKOUT", checkout);

    const checkoutUrl =
      checkout.body &&
      typeof checkout.body === "object" &&
      "checkoutUrl" in checkout.body &&
      typeof checkout.body.checkoutUrl === "string"
        ? checkout.body.checkoutUrl
        : undefined;

    console.log("CHECKOUT_URL_PRESENT:", Boolean(checkoutUrl));

    if (!checkout.ok || !checkoutUrl?.startsWith("https://checkout.stripe.com/")) {
      markFailed("Authenticated checkout did not return a Stripe checkout URL.");
    }

    const usage = await post(`${baseUrl}/api/account/usage`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logResult("USAGE", usage);

    if (!usage.ok) {
      markFailed("Usage request failed.");
    }

    if (usage.body && typeof usage.body === "object" && !("plan" in usage.body)) {
      markFailed("Usage response did not include plan.");
    }


    const portal = await post(`${baseUrl}/api/billing/portal`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logResult("BILLING_PORTAL", portal);

    const portalUrl =
      portal.body &&
      typeof portal.body === "object" &&
      "portalUrl" in portal.body &&
      typeof portal.body.portalUrl === "string"
        ? portal.body.portalUrl
        : undefined;

    const portalError =
      portal.body &&
      typeof portal.body === "object" &&
      "error" in portal.body &&
      typeof portal.body.error === "string"
        ? portal.body.error
        : undefined;

    console.log("BILLING_PORTAL_URL_PRESENT:", Boolean(portalUrl));

    if (portal.ok) {
      if (!portalUrl?.startsWith("https://")) {
        markFailed("Billing portal did not return a URL.");
      }
    } else if (portal.status !== 400 || portalError !== "No active billing account found.") {
      markFailed("Billing portal did not return a portal URL or friendly no-customer error.");
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
