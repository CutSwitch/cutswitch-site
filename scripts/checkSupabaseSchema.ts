import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

type TableCheck = {
  table: string;
  columns: string[];
};

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

const checks: TableCheck[] = [
  {
    table: "feedback_events",
    columns: [
      "id",
      "user_id",
      "user_email",
      "type",
      "title",
      "message",
      "screen",
      "current_page",
      "app_area",
      "context_json",
      "severity",
      "status",
      "source",
      "created_at",
    ],
  },
  {
    table: "product_events",
    columns: [
      "id",
      "user_id",
      "event_type",
      "screen",
      "app_version",
      "project_fingerprint",
      "source_duration_seconds",
      "metadata_json",
      "created_at",
    ],
  },
  {
    table: "admin_events",
    columns: ["id", "admin_user_id", "action", "target_type", "target_id", "metadata_json", "created_at"],
  },
];

function safeError(error: { code?: string; message?: string; details?: string; hint?: string } | null) {
  if (!error) return null;
  return {
    code: error.code || "unknown",
    message: error.message || "unknown",
    details: error.details || null,
    hint: error.hint || null,
  };
}

loadDotEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = false;

console.log("Supabase schema check");
console.log("Project URL host:", new URL(supabaseUrl).host);

for (const check of checks) {
  const { error } = await supabase.from(check.table).select(check.columns.join(",")).limit(0);

  if (error) {
    failed = true;
    console.log(
      JSON.stringify(
        {
          table: check.table,
          status: "missing_or_mismatched",
          expectedColumns: check.columns,
          error: safeError(error),
        },
        null,
        2
      )
    );
  } else {
    console.log(
      JSON.stringify(
        {
          table: check.table,
          status: "ok",
          expectedColumns: check.columns,
        },
        null,
        2
      )
    );
  }
}

process.exitCode = failed ? 1 : 0;
