import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type ApiResult = {
  ok: boolean;
  status: number | "NETWORK_ERROR";
  body: unknown;
};

const DEFAULT_BASE_URL = "https://cutswitch-site.vercel.app";

loadDotEnvLocal();

const baseUrl = (process.env.TEST_BACKEND_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const checkoutPlanId = process.env.TEST_CHECKOUT_PLAN_ID || "starter";
const transcriptDuration = Number(process.env.TEST_TRANSCRIPT_DURATION_SECONDS || 7);
const testProductEvents = process.env.TEST_PRODUCT_EVENTS === "1";
const testSocialReels = process.env.TEST_SOCIAL_REELS === "1";

let failed = false;

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const envFile = readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^[']|[']$/g, "").replace(/^["]|["]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function markFailed(message: string) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;

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
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function post(url: string, init: RequestInit): Promise<ApiResult> {
  try {
    const res = await fetch(url, { method: "POST", ...init });
    return { ok: res.ok, status: res.status, body: await readBody(res) };
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
    const body = result.body.length > 1200 ? `${result.body.slice(0, 1200)}\n...[truncated ${result.body.length - 1200} chars]` : result.body;
    console.log(`${label}:`, body);
    return;
  }

  console.log(`${label}:`, JSON.stringify(redactSecrets(result.body), null, 2));
}

function numberField(body: unknown, key: string): number | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function booleanField(body: unknown, key: string): boolean | null {
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function makeSocialReelsSmokeText() {
  const sentences = [
    "CutSwitch helps editors find the strongest moments in a long conversation without guessing where the story begins.",
    "The best clip usually starts when someone makes a clear claim and ends when they land the payoff with a memorable line.",
    "This smoke segment gives the backend enough transcript density to choose anchors for short reels and longer highlights.",
    "The speaker explains a practical lesson, shares a transformation, challenges a common belief, and gives producers a reason to keep watching.",
    "A good social moment has context, escalation, and a clean final thought that can stand alone outside the full episode.",
  ];

  return Array.from({ length: 3 }, () => sentences.join(" ")).join(" ");
}

function durationFitsSocialReelsBucket(bucket: unknown, duration: unknown) {
  if (typeof bucket !== "string" || typeof duration !== "number") return false;
  if (bucket === "15s") return duration >= 12 && duration <= 18;
  if (bucket === "30s") return duration >= 26 && duration <= 34;
  if (bucket === "60s") return duration >= 54 && duration <= 66;
  if (bucket === "90s") return duration >= 82 && duration <= 98;
  if (bucket === "5-10m") return duration >= 300 && duration <= 600;
  return false;
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
  if (unauthCheckout.status !== 401) markFailed("Unauthenticated checkout did not return 401.");

  const unauthPortal = await post(`${baseUrl}/api/billing/portal`, { headers: {} });
  logResult("BILLING_PORTAL_UNAUTHENTICATED", unauthPortal);
  if (unauthPortal.status !== 401) markFailed("Unauthenticated billing portal did not return 401.");

  const unauthTranscript = await post(`${baseUrl}/api/transcripts/complete`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectFingerprint: "codex-unauth-project",
      audioFingerprint: "codex-unauth-audio",
      durationSeconds: 1,
      speakerCount: 1,
      providerJobId: null,
      status: "succeeded",
    }),
  });
  logResult("TRANSCRIPT_UNAUTHENTICATED", unauthTranscript);
  if (unauthTranscript.status !== 401) markFailed("Unauthenticated transcript completion did not return 401.");

  if (testProductEvents) {
    const unauthProductEvent = await post(`${baseUrl}/api/product-events`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "app_opened" }),
    });
    logResult("PRODUCT_EVENT_UNAUTHENTICATED", unauthProductEvent);
    if (unauthProductEvent.status !== 401) markFailed("Unauthenticated product event did not return 401.");
  }

  if (testSocialReels) {
    const unauthSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    logResult("SOCIAL_REELS_UNAUTHENTICATED", unauthSocialReels);
    if (unauthSocialReels.status !== 401) markFailed("Unauthenticated social reels discovery did not return 401.");
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
  const refreshToken =
    login.body &&
    typeof login.body === "object" &&
    "refresh_token" in login.body &&
    typeof login.body.refresh_token === "string"
      ? login.body.refresh_token
      : undefined;

  console.log("ACCESS_TOKEN_PRESENT:", Boolean(token));
  console.log("REFRESH_TOKEN_PRESENT:", Boolean(refreshToken));
  if (!login.ok) markFailed("Login request failed.");
  if (!token) markFailed("Login response did not include access_token.");
  if (!refreshToken) markFailed("Login response did not include refresh_token.");

  const invalidRefresh = await post(`${baseUrl}/api/app/session/refresh`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: "not-a-valid-refresh-token" }),
  });
  logResult("REFRESH_INVALID", invalidRefresh);
  if (invalidRefresh.status !== 401) markFailed("Invalid refresh token did not return 401.");

  if (refreshToken) {
    const refresh = await post(`${baseUrl}/api/app/session/refresh`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    logResult("REFRESH", refresh);
    const refreshedToken =
      refresh.body &&
      typeof refresh.body === "object" &&
      "access_token" in refresh.body &&
      typeof refresh.body.access_token === "string"
        ? refresh.body.access_token
        : undefined;
    console.log("REFRESH_ACCESS_TOKEN_PRESENT:", Boolean(refreshedToken));
    if (!refresh.ok || !refreshedToken) markFailed("Valid refresh did not return a new access_token.");
  }

  if (token) {
    if (testProductEvents) {
      const invalidProductEvent = await post(`${baseUrl}/api/product-events`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type: "not_a_product_event" }),
      });
      logResult("PRODUCT_EVENT_INVALID", invalidProductEvent);
      if (invalidProductEvent.status !== 400) markFailed("Invalid product event did not return 400.");

      const productEvent = await post(`${baseUrl}/api/product-events`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event_type: "app_opened",
          screen: "Codex Smoke",
          app_version: "codex-test",
          project_fingerprint: `codex-product-${Date.now()}`,
          metadata_json: { source: "testBackend" },
        }),
      });
      logResult("PRODUCT_EVENT", productEvent);
      if (!productEvent.ok) markFailed("Valid product event did not insert successfully.");
    } else {
      console.log("PRODUCT_EVENTS: skipped. Set TEST_PRODUCT_EVENTS=1 after applying the product_events migration.");
    }

    if (testSocialReels) {
      const socialReelsSmokeText = makeSocialReelsSmokeText();
      const invalidSocialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source_duration_seconds: 1800,
          project_hash: "codex-social-invalid",
          duration_preferences: ["not-a-duration"],
          requested_candidate_count: 2,
          style: "balanced",
          layout: "vertical",
          caption_style: "bold",
          episode_metadata: {},
          segments: [],
        }),
      });
      logResult("SOCIAL_REELS_INVALID", invalidSocialReels);
      if (invalidSocialReels.status !== 400) markFailed("Invalid social reels payload did not return 400.");

      const socialReels = await post(`${baseUrl}/api/social-reels/discover`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          project_hash: `codex-social-${Date.now()}`,
          source_duration_seconds: 1800,
          duration_preferences: ["mixed"],
          requested_candidate_count: 30,
          style: "balanced",
          layout: "vertical",
          caption_style: "bold",
          episode_metadata: { title: "Codex smoke test" },
          context: { platform: "social", content_notes: "Smoke test only." },
          segments: [
            {
              segment_id: "codex-seg-1",
              start_seconds: 0,
              end_seconds: 720,
              speaker: "Speaker 1",
              text: socialReelsSmokeText,
            },
          ],
        }),
      });
      logResult("SOCIAL_REELS", socialReels);

      const candidates =
        socialReels.body &&
        typeof socialReels.body === "object" &&
        "candidates" in socialReels.body &&
        Array.isArray(socialReels.body.candidates)
          ? socialReels.body.candidates
          : [];
      if (!socialReels.ok || candidates.length < 30) {
        markFailed("Valid social reels discovery did not return at least 30 candidates.");
      }
      const missingAnchors = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return (
          typeof record.start_anchor_quote !== "string" ||
          record.start_anchor_quote.trim().length === 0 ||
          !socialReelsSmokeText.includes(record.start_anchor_quote) ||
          typeof record.end_anchor_quote !== "string" ||
          record.end_anchor_quote.trim().length === 0 ||
          !socialReelsSmokeText.includes(record.end_anchor_quote)
        );
      });
      if (missingAnchors) {
        markFailed("Social reels candidates included empty anchor quotes.");
      }

      const buckets = new Set<string>();
      const invalidCandidateDiversity = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        if (record.duration_bucket === "mixed") return true;
        if (typeof record.duration_bucket === "string") buckets.add(record.duration_bucket);
        return (
          typeof record.clip_type !== "string" ||
          typeof record.topic_tag !== "string" ||
          typeof record.hook_title !== "string" ||
          typeof record.social_caption !== "string" ||
          typeof record.why_it_works !== "string" ||
          !record.scores ||
          typeof record.scores !== "object"
        );
      });
      if (invalidCandidateDiversity) {
        markFailed("Social reels candidates were missing editorial diversity fields or returned mixed as a concrete bucket.");
      }
      if (buckets.size < 2) {
        markFailed("Mixed social reels request did not return multiple concrete duration buckets.");
      }

      const invalidBucketDurations = candidates.some((candidate) => {
        if (!candidate || typeof candidate !== "object") return true;
        const record = candidate as Record<string, unknown>;
        return !durationFitsSocialReelsBucket(record.duration_bucket, record.duration_seconds);
      });
      if (invalidBucketDurations) {
        markFailed("Social reels candidates included rough durations outside their duration buckets.");
      }
    } else {
      console.log("SOCIAL_REELS: skipped. Set TEST_SOCIAL_REELS=1 after deploying /api/social-reels/discover.");
    }

    const invalidCheckout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: "not_a_plan" }),
    });
    logResult("CHECKOUT_INVALID_PLAN", invalidCheckout);
    if (invalidCheckout.status !== 400) markFailed("Invalid checkout plan did not return 400.");

    const checkout = await post(`${baseUrl}/api/billing/checkout`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      headers: { Authorization: `Bearer ${token}` },
    });
    logResult("USAGE", usage);
    if (!usage.ok) markFailed("Usage request failed.");
    if (usage.body && typeof usage.body === "object" && !("plan" in usage.body)) {
      markFailed("Usage response did not include plan.");
    }

    const usageBefore = numberField(usage.body, "totalUsedSeconds");
    const remainingBefore = numberField(usage.body, "remainingSeconds");
    const isTrial = booleanField(usage.body, "isTrial");
    if (isTrial === null) markFailed("Usage response did not include isTrial.");
    if (isTrial && numberField(usage.body, "trialIncludedSeconds") !== 14400) {
      markFailed("Trial usage response did not include 4 hours of editing time.");
    }
    const transcriptKey = `codex-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const transcriptPayload = {
      projectFingerprint: `${transcriptKey}-project`,
      audioFingerprint: `${transcriptKey}-audio`,
      durationSeconds: transcriptDuration,
      speakerCount: 2,
      providerJobId: null,
      status: "succeeded",
    };

    const transcriptSuccess = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(transcriptPayload),
    });
    logResult("TRANSCRIPT_SUCCESS", transcriptSuccess);
    if (numberField(transcriptSuccess.body, "billableSeconds") !== transcriptDuration) {
      markFailed("Successful transcript did not bill the expected duration.");
    }

    const transcriptDuplicate = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(transcriptPayload),
    });
    logResult("TRANSCRIPT_DUPLICATE", transcriptDuplicate);
    const duplicateReused =
      transcriptDuplicate.body &&
      typeof transcriptDuplicate.body === "object" &&
      "reused" in transcriptDuplicate.body &&
      transcriptDuplicate.body.reused === true;
    if (numberField(transcriptDuplicate.body, "billableSeconds") !== 0 || !duplicateReused) {
      markFailed("Duplicate successful transcript was not treated as reused.");
    }

    const failedTranscript = await post(`${baseUrl}/api/transcripts/complete`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        projectFingerprint: `${transcriptKey}-failed-project`,
        audioFingerprint: `${transcriptKey}-failed-audio`,
        durationSeconds: transcriptDuration,
        speakerCount: 2,
        providerJobId: null,
        status: "failed",
      }),
    });
    logResult("TRANSCRIPT_FAILED", failedTranscript);
    if (numberField(failedTranscript.body, "billableSeconds") !== 0) {
      markFailed("Failed transcript billed usage unexpectedly.");
    }

    const exportTelemetry = await post(`${baseUrl}/api/events/export`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: `codex-export-${transcriptKey.slice(-16)}`,
        export_success: true,
      }),
    });
    logResult("EXPORT_TELEMETRY", exportTelemetry);

    const usageAfter = await post(`${baseUrl}/api/account/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    logResult("USAGE_AFTER_TRANSCRIPT", usageAfter);
    const usageAfterTotal = numberField(usageAfter.body, "totalUsedSeconds");
    const remainingAfter = numberField(usageAfter.body, "remainingSeconds");

    if (usageBefore !== null && usageAfterTotal !== usageBefore + transcriptDuration) {
      markFailed("Account usage did not increase by the successful transcript duration only.");
    }

    if (remainingBefore !== null && remainingAfter !== remainingBefore - transcriptDuration) {
      markFailed("Remaining editing seconds did not decrease by the successful transcript duration only.");
    }

    if (isTrial && remainingAfter !== null) {
      const overageDuration = Math.max(1, remainingAfter + 1);
      const trialOverage = await post(`${baseUrl}/api/transcripts/complete`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectFingerprint: `${transcriptKey}-trial-overage-project`,
          audioFingerprint: `${transcriptKey}-trial-overage-audio`,
          durationSeconds: overageDuration,
          speakerCount: 2,
          providerJobId: null,
          status: "succeeded",
        }),
      });
      logResult("TRANSCRIPT_TRIAL_OVERAGE", trialOverage);
      const trialOverageError =
        trialOverage.body &&
        typeof trialOverage.body === "object" &&
        "error" in trialOverage.body &&
        trialOverage.body.error === "Trial editing time exhausted";
      if (trialOverage.status !== 402 || !trialOverageError) {
        markFailed("Trial overage did not return Trial editing time exhausted.");
      }
    } else {
      console.log("TRANSCRIPT_TRIAL_OVERAGE: skipped because test account is not trialing.");
    }

    const portal = await post(`${baseUrl}/api/billing/portal`, {
      headers: { Authorization: `Bearer ${token}` },
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
      if (!portalUrl?.startsWith("https://")) markFailed("Billing portal did not return a URL.");
    } else if (portal.status !== 400 || portalError !== "No active billing account found.") {
      markFailed("Billing portal did not return a portal URL or friendly no-customer error.");
    }
  }

  const missingTokenUsage = await post(`${baseUrl}/api/account/usage`, { headers: {} });
  logResult("USAGE_MISSING_TOKEN", missingTokenUsage);
  if (missingTokenUsage.ok) markFailed("Usage request without Authorization unexpectedly succeeded.");

  process.exitCode = failed ? 1 : 0;
}
