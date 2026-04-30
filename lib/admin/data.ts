import { unstable_noStore as noStore } from "next/cache";

import { getAppPlan } from "@/lib/plans";
import { TRIAL_EDITING_SECONDS } from "@/lib/subscriptions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAGE_SIZE = 25;

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_active_at: string | null;
  last_product_event: string | null;
  last_product_event_at: string | null;
  has_project_imported: boolean;
  has_run_started: boolean;
  has_run_succeeded: boolean;
  run_failed_events: number;
  plan: string | null;
  subscription_status: string | null;
  editing_seconds_used: number;
  editing_seconds_remaining: number | null;
  successful_jobs: number;
  failed_jobs: number;
  signal: "Active" | "Stuck" | "Near quota" | "Heavy user" | "Trial inactive";
};

export type AdminJobRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_plan: string | null;
  user_subscription_status: string | null;
  status: string | null;
  duration_seconds: number | null;
  billable_seconds: number | null;
  error_code: string | null;
  error_message: string | null;
  app_version: string | null;
  created_at: string | null;
  completed_at: string | null;
};

export type FeedbackRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_plan?: string | null;
  user_subscription_status?: string | null;
  type: string;
  message: string;
  screen: string | null;
  current_page?: string | null;
  app_area?: string | null;
  admin_notes?: string | null;
  context_json?: Record<string, unknown> | null;
  severity: string;
  status: string;
  title?: string | null;
  summary?: string | null;
  product_area?: string | null;
  suggested_owner?: string | null;
  suggested_branch_name?: string | null;
  reproduction_likelihood?: string | null;
  recommended_next_action?: string | null;
  codex_ready?: boolean | null;
  customer_impact?: string | null;
  admin_priority?: string | null;
  ai_should_be_codex_task?: boolean | null;
  ai_title?: string | null;
  ai_summary?: string | null;
  ai_category?: string | null;
  ai_suggested_branch_name?: string | null;
  ai_recommended_next_action?: string | null;
  created_at: string;
};

type DbUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_seen_at?: string | null;
  first_project_imported_at?: string | null;
  first_run_started_at?: string | null;
  first_successful_edit_at?: string | null;
};

type DbSubscription = {
  user_id: string;
  plan_id: string | null;
  status: string | null;
  created_at: string | null;
};

type UsageEvent = {
  user_id: string;
  event_type: string;
  billable_seconds: number | null;
  created_at: string | null;
};

type TranscriptJob = {
  user_id: string;
  status: string | null;
  created_at: string | null;
};

type ProductEvent = {
  user_id: string;
  event_type: string;
  created_at: string | null;
};

type ProductEventDetail = ProductEvent & {
  screen: string | null;
  app_version: string | null;
  project_fingerprint: string | null;
  source_duration_seconds: number | null;
  metadata_json: Record<string, unknown> | null;
};

const FEEDBACK_SELECT = [
  "id",
  "user_id",
  "user_email",
  "type",
  "message",
  "screen",
  "current_page",
  "app_area",
  "admin_notes",
  "context_json",
  "severity",
  "status",
  "title",
  "summary",
  "product_area",
  "suggested_owner",
  "suggested_branch_name",
  "reproduction_likelihood",
  "recommended_next_action",
  "codex_ready",
  "customer_impact",
  "admin_priority",
  "ai_should_be_codex_task",
  "ai_title",
  "ai_summary",
  "ai_category",
  "ai_suggested_branch_name",
  "ai_recommended_next_action",
  "created_at",
].join(",");

function startOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfPreviousMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
}

function startOfWindowIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function secondsToHours(seconds: number | null | undefined) {
  return (seconds || 0) / 3600;
}

export function formatHours(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "-";
  const hours = secondsToHours(seconds);
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: hours < 10 ? 1 : 0 })}h`;
}

function newestSubscriptionByUser(rows: DbSubscription[]) {
  const map = new Map<string, DbSubscription>();
  for (const row of rows) {
    const existing = map.get(row.user_id);
    if (!existing || String(row.created_at || "") > String(existing.created_at || "")) {
      map.set(row.user_id, row);
    }
  }
  return map;
}

function getAllowanceSeconds(subscription: DbSubscription | undefined) {
  if (!subscription?.plan_id) return null;
  if (subscription.status === "trialing") return TRIAL_EDITING_SECONDS;
  return getAppPlan(subscription.plan_id)?.transcriptHours
    ? getAppPlan(subscription.plan_id)!.transcriptHours * 3600
    : null;
}

function signalFor(input: {
  user: DbUser;
  subscription?: DbSubscription;
  usedSeconds: number;
  remainingSeconds: number | null;
  successfulJobs: number;
  failedJobs: number;
  hasProjectImported: boolean;
  hasRunStarted: boolean;
  hasRunSucceeded: boolean;
  runFailedEvents: number;
}) : AdminUserRow["signal"] {
  const allowanceSeconds = getAllowanceSeconds(input.subscription);
  const isNearQuota =
    allowanceSeconds && input.remainingSeconds !== null
      ? input.remainingSeconds <= Math.max(1800, allowanceSeconds * 0.1)
      : false;

  if (input.subscription?.status === "trialing" && !input.hasRunStarted && input.successfulJobs === 0) return "Trial inactive";
  if (
    input.failedJobs >= 2 ||
    input.runFailedEvents >= 2 ||
    (input.hasProjectImported && !input.hasRunSucceeded) ||
    (input.user.first_project_imported_at && !input.user.first_successful_edit_at)
  ) return "Stuck";
  if (isNearQuota) return "Near quota";
  if (input.usedSeconds >= 10 * 3600 || input.successfulJobs >= 5) return "Heavy user";
  return "Active";
}

function buildUserRows(input: {
  users: DbUser[];
  subscriptions: DbSubscription[];
  usageEvents: UsageEvent[];
  transcriptJobs: TranscriptJob[];
  productEvents: ProductEvent[];
}) {
  const subscriptionsByUser = newestSubscriptionByUser(input.subscriptions);
  const usedByUser = new Map<string, number>();
  const successfulByUser = new Map<string, number>();
  const failedByUser = new Map<string, number>();
  const lastActivityByUser = new Map<string, string>();
  const lastProductEventByUser = new Map<string, ProductEvent>();
  const importedByUser = new Set<string>();
  const runStartedByUser = new Set<string>();
  const runSucceededByUser = new Set<string>();
  const runFailedByUser = new Map<string, number>();

  for (const event of input.usageEvents) {
    if (event.event_type === "transcript_succeeded") {
      usedByUser.set(event.user_id, (usedByUser.get(event.user_id) || 0) + (event.billable_seconds || 0));
    }
    if (event.created_at) lastActivityByUser.set(event.user_id, maxIso(lastActivityByUser.get(event.user_id), event.created_at));
  }

  for (const job of input.transcriptJobs) {
    if (job.status === "succeeded") successfulByUser.set(job.user_id, (successfulByUser.get(job.user_id) || 0) + 1);
    if (job.status === "failed") failedByUser.set(job.user_id, (failedByUser.get(job.user_id) || 0) + 1);
    if (job.created_at) lastActivityByUser.set(job.user_id, maxIso(lastActivityByUser.get(job.user_id), job.created_at));
  }

  for (const event of input.productEvents) {
    if (event.created_at) lastActivityByUser.set(event.user_id, maxIso(lastActivityByUser.get(event.user_id), event.created_at));
    const previous = lastProductEventByUser.get(event.user_id);
    if (!previous || String(event.created_at || "") > String(previous.created_at || "")) {
      lastProductEventByUser.set(event.user_id, event);
    }
    if (event.event_type === "project_imported") importedByUser.add(event.user_id);
    if (event.event_type === "run_started" || event.event_type === "run_clicked") runStartedByUser.add(event.user_id);
    if (event.event_type === "run_succeeded") runSucceededByUser.add(event.user_id);
    if (event.event_type === "run_failed") runFailedByUser.set(event.user_id, (runFailedByUser.get(event.user_id) || 0) + 1);
  }

  return input.users.map((user) => {
    const subscription = subscriptionsByUser.get(user.id);
    const usedSeconds = usedByUser.get(user.id) || 0;
    const allowanceSeconds = getAllowanceSeconds(subscription);
    const remainingSeconds = allowanceSeconds === null ? null : Math.max(0, allowanceSeconds - usedSeconds);
    const successfulJobs = successfulByUser.get(user.id) || 0;
    const failedJobs = failedByUser.get(user.id) || 0;
    const lastProductEvent = lastProductEventByUser.get(user.id);
    const hasProjectImported = importedByUser.has(user.id) || Boolean(user.first_project_imported_at);
    const hasRunStarted = runStartedByUser.has(user.id) || Boolean(user.first_run_started_at);
    const hasRunSucceeded = runSucceededByUser.has(user.id) || successfulJobs > 0 || Boolean(user.first_successful_edit_at);
    const runFailedEvents = runFailedByUser.get(user.id) || 0;

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_active_at: maxIso(user.last_seen_at, lastActivityByUser.get(user.id)) || user.created_at,
      last_product_event: lastProductEvent?.event_type ?? null,
      last_product_event_at: lastProductEvent?.created_at ?? null,
      has_project_imported: hasProjectImported,
      has_run_started: hasRunStarted,
      has_run_succeeded: hasRunSucceeded,
      run_failed_events: runFailedEvents,
      plan: subscription?.plan_id ?? null,
      subscription_status: subscription?.status ?? null,
      editing_seconds_used: usedSeconds,
      editing_seconds_remaining: remainingSeconds,
      successful_jobs: successfulJobs,
      failed_jobs: failedJobs,
      signal: signalFor({
        user,
        subscription,
        usedSeconds,
        remainingSeconds,
        successfulJobs,
        failedJobs,
        hasProjectImported,
        hasRunStarted,
        hasRunSucceeded,
        runFailedEvents,
      }),
    } satisfies AdminUserRow;
  });
}

function maxIso(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b || "";
  if (!b) return a;
  return a > b ? a : b;
}

function daysSince(iso: string) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 0;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

async function fetchSubscriptions(userIds?: string[]) {
  let query = supabaseAdmin
    .from("subscriptions")
    .select("user_id,plan_id,status,created_at")
    .order("created_at", { ascending: false });
  if (userIds?.length) query = query.in("user_id", userIds);
  const { data, error } = await query.returns<DbSubscription[]>();
  if (error) {
    if (isMissingOptionalSchema(error)) return [];
    throw error;
  }
  return data || [];
}

async function fetchUsageEvents(userIds?: string[], since?: string) {
  let query = supabaseAdmin
    .from("usage_events")
    .select("user_id,event_type,billable_seconds,created_at")
    .order("created_at", { ascending: false });
  if (userIds?.length) query = query.in("user_id", userIds);
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query.returns<UsageEvent[]>();
  if (error) {
    if (isMissingOptionalSchema(error)) return [];
    throw error;
  }
  return data || [];
}

async function fetchTranscriptJobs(userIds?: string[], since?: string) {
  let query = supabaseAdmin
    .from("transcript_jobs")
    .select("user_id,status,created_at")
    .order("created_at", { ascending: false });
  if (userIds?.length) query = query.in("user_id", userIds);
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query.returns<TranscriptJob[]>();
  if (error) {
    if (isMissingOptionalSchema(error)) return [];
    throw error;
  }
  return data || [];
}

function isMissingProductEventsSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

function isMissingOptionalSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

async function fetchUsers(options?: { search?: string; id?: string; limit?: number }) {
  const fullSelect = "id,email,created_at,last_seen_at,first_project_imported_at,first_run_started_at,first_successful_edit_at";
  let query = supabaseAdmin
    .from("users")
    .select(fullSelect)
    .order("created_at", { ascending: false })
    .limit(options?.limit || 1000);

  if (options?.id) query = query.eq("id", options.id);
  if (options?.search?.trim()) query = query.ilike("email", `%${options.search.trim()}%`);

  const { data, error } = await query.returns<DbUser[]>();
  if (!error) return data || [];
  if (!isMissingOptionalSchema(error)) throw error;

  let fallback = supabaseAdmin
    .from("users")
    .select("id,email,created_at")
    .order("created_at", { ascending: false })
    .limit(options?.limit || 1000);

  if (options?.id) fallback = fallback.eq("id", options.id);
  if (options?.search?.trim()) fallback = fallback.ilike("email", `%${options.search.trim()}%`);

  const { data: fallbackData, error: fallbackError } = await fallback.returns<Array<{ id: string; email: string | null; created_at: string | null }>>();
  if (fallbackError) {
    if (isMissingOptionalSchema(fallbackError)) return [];
    throw fallbackError;
  }

  return (fallbackData || []).map((user) => ({
    ...user,
    last_seen_at: null,
    first_project_imported_at: null,
    first_run_started_at: null,
    first_successful_edit_at: null,
  })) satisfies DbUser[];
}

async function fetchProductEvents(userIds?: string[], since?: string) {
  let query = supabaseAdmin
    .from("product_events")
    .select("user_id,event_type,created_at")
    .order("created_at", { ascending: false });
  if (userIds?.length) query = query.in("user_id", userIds);
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query.returns<ProductEvent[]>();
  if (error) {
    if (isMissingProductEventsSchema(error)) return [];
    throw error;
  }
  return data || [];
}

async function fetchCurrentSubscriptionMap(userIds: string[]) {
  const subscriptions = await fetchSubscriptions(userIds);
  return newestSubscriptionByUser(subscriptions);
}

async function fetchUserEmailMap(userIds: string[]) {
  const emails = new Map<string, string | null>();
  if (!userIds.length) return emails;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,email")
    .in("id", userIds)
    .returns<Array<{ id: string; email: string | null }>>();
  if (error) throw error;
  for (const user of data || []) emails.set(user.id, user.email);
  return emails;
}

async function fetchTranscriptJobRows(options?: {
  userId?: string;
  since?: string;
  status?: string;
  errorCode?: string;
  limit?: number;
}) {
  const limit = options?.limit || 100;
  let query = supabaseAdmin
    .from("transcript_jobs")
    .select("id,user_id,status,duration_seconds,billable_seconds,error_code,error_message,app_version,created_at,completed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.userId) query = query.eq("user_id", options.userId);
  if (options?.since) query = query.gte("created_at", options.since);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.errorCode) query = query.eq("error_code", options.errorCode);

  const { data, error } = await query.returns<AdminJobRow[]>();
  if (!error) return data || [];
  if (!isMissingOptionalSchema(error)) throw error;

  let fallback = supabaseAdmin
    .from("transcript_jobs")
    .select("id,user_id,status,duration_seconds,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.userId) fallback = fallback.eq("user_id", options.userId);
  if (options?.since) fallback = fallback.gte("created_at", options.since);
  if (options?.status) fallback = fallback.eq("status", options.status);

  const { data: fallbackData, error: fallbackError } = await fallback.returns<
    Array<Pick<AdminJobRow, "id" | "user_id" | "status" | "duration_seconds" | "created_at">>
  >();
  if (fallbackError) {
    if (isMissingOptionalSchema(fallbackError)) return [];
    throw fallbackError;
  }
  return (fallbackData || []).map((job) => ({
    ...job,
    user_email: null,
    user_plan: null,
    user_subscription_status: null,
    billable_seconds: null,
    error_code: null,
    error_message: null,
    app_version: null,
    completed_at: null,
  }));
}

async function enrichJobRows(rows: AdminJobRow[]) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean) as string[])];
  const [emails, subscriptions] = await Promise.all([
    fetchUserEmailMap(userIds),
    fetchCurrentSubscriptionMap(userIds),
  ]);

  return rows.map((row) => {
    const subscription = row.user_id ? subscriptions.get(row.user_id) : undefined;
    return {
      ...row,
      user_email: row.user_id ? emails.get(row.user_id) ?? null : null,
      user_plan: subscription?.plan_id ?? null,
      user_subscription_status: subscription?.status ?? null,
      error_message: sanitizeShortText(row.error_message),
    };
  });
}

function sanitizeShortText(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/\/Users\/[^\s]+/g, "[redacted-path]")
    .replace(/[A-Za-z]:\\[^\s]+/g, "[redacted-path]")
    .slice(0, 240);
}

function dateRangeToSince(range: string | undefined) {
  const now = Date.now();
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "90d") return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

export async function getAdminUsers(options?: { search?: string; signal?: string; status?: string; plan?: string; range?: string; sort?: string; page?: number }) {
  noStore();
  const page = Math.max(1, options?.page || 1);
  const search = options?.search?.trim();
  const users = await fetchUsers({ search, limit: 1000 });

  const userIds = users.map((user) => user.id);
  const [subscriptions, usageEvents, transcriptJobs, productEvents] = await Promise.all([
    fetchSubscriptions(userIds),
    fetchUsageEvents(userIds),
    fetchTranscriptJobs(userIds),
    fetchProductEvents(userIds),
  ]);

  const allRows = buildUserRows({ users, subscriptions, usageEvents, transcriptJobs, productEvents })
    .filter((row) => (options?.signal ? row.signal === options.signal : true))
    .filter((row) => {
      if (!options?.status) return true;
      if (options.status === "inactive") return !row.subscription_status;
      if (options.status === "churn-risk") return row.signal === "Stuck" || row.signal === "Trial inactive";
      return row.subscription_status === options.status;
    })
    .filter((row) => (options?.plan ? row.plan === options.plan : true))
    .filter((row) => {
      const since = dateRangeToSince(options?.range);
      if (!since || !row.last_active_at) return true;
      return row.last_active_at >= since;
    })
    .sort((a, b) => {
      if (options?.sort === "used") return b.editing_seconds_used - a.editing_seconds_used;
      if (options?.sort === "plan") return String(a.plan || "").localeCompare(String(b.plan || ""));
      if (options?.sort === "email") return String(a.email || "").localeCompare(String(b.email || ""));
      return String(b.last_active_at || "").localeCompare(String(a.last_active_at || ""));
    });
  const from = (page - 1) * PAGE_SIZE;
  const rows = allRows.slice(from, from + PAGE_SIZE);

  return {
    rows,
    page,
    pageSize: PAGE_SIZE,
    total: allRows.length,
    search: search || "",
  };
}

export async function getAdminUserDetail(id: string) {
  noStore();
  const [user] = await fetchUsers({ id, limit: 1 });
  if (!user) return null;

  const [subscriptions, usageEvents, basicTranscriptJobs, detailedJobs, detailedProductEvents, feedbackRows] = await Promise.all([
    fetchSubscriptions([id]),
    fetchUsageEvents([id]),
    fetchTranscriptJobs([id]),
    fetchTranscriptJobRows({ userId: id, limit: 25 }),
    fetchProductEventDetails({ userId: id, limit: 25 }),
    getFeedbackRowsForUser(id),
  ]);

  const [row] = buildUserRows({
    users: [user],
    subscriptions,
    usageEvents,
    transcriptJobs: basicTranscriptJobs,
    productEvents: detailedProductEvents,
  });

  const reusedCount = usageEvents.filter((event) => event.event_type === "transcript_reused").length;

  return {
    user,
    row,
    reusedCount,
    firstSuccessfulRunAt: user.first_successful_edit_at || basicTranscriptJobs.find((job) => job.status === "succeeded")?.created_at || null,
    productEvents: detailedProductEvents,
    jobs: await enrichJobRows(detailedJobs),
    feedback: feedbackRows,
  };
}

export async function getAllAdminUserRows() {
  noStore();
  const users = await fetchUsers({ limit: 1000 });
  const userIds = users.map((user) => user.id);
  const [subscriptions, usageEvents, transcriptJobs, productEvents] = await Promise.all([
    fetchSubscriptions(userIds),
    fetchUsageEvents(userIds),
    fetchTranscriptJobs(userIds),
    fetchProductEvents(userIds),
  ]);
  return buildUserRows({ users, subscriptions, usageEvents, transcriptJobs, productEvents });
}

export async function getFilteredAdminUserRows(options?: { search?: string; signal?: string; status?: string; plan?: string; range?: string; sort?: string }) {
  const result = await getAdminUsers({ ...options, page: 1 });
  const pages = Math.ceil(result.total / result.pageSize);
  if (pages <= 1) return result.rows;

  const rows = [...result.rows];
  for (let page = 2; page <= pages; page += 1) {
    const next = await getAdminUsers({ ...options, page });
    rows.push(...next.rows);
  }
  return rows;
}

async function fetchProductEventDetails(options: { userId?: string; limit?: number }) {
  let query = supabaseAdmin
    .from("product_events")
    .select("user_id,event_type,screen,app_version,project_fingerprint,source_duration_seconds,metadata_json,created_at")
    .order("created_at", { ascending: false })
    .limit(options.limit || 50);
  if (options.userId) query = query.eq("user_id", options.userId);
  const { data, error } = await query.returns<ProductEventDetail[]>();
  if (error) {
    if (isMissingProductEventsSchema(error)) return [];
    throw error;
  }
  return data || [];
}

async function getFeedbackRowsForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("feedback_events")
    .select(FEEDBACK_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25)
    .returns<FeedbackRow[]>();
  if (error) {
    if (isMissingOptionalSchema(error)) return [];
    throw error;
  }
  return (data || []).map((row) => ({ ...row, user_email: row.user_email || null })) satisfies FeedbackRow[];
}

export async function getAdminJobs(filters?: {
  status?: string;
  plan?: string;
  range?: string;
  errorCode?: string;
  q?: string;
}) {
  noStore();
  const since = dateRangeToSince(filters?.range || "all");
  const rows = await enrichJobRows(await fetchTranscriptJobRows({
    since,
    status: filters?.status || undefined,
    errorCode: filters?.errorCode || undefined,
    limit: 200,
  }));
  const q = filters?.q?.trim().toLowerCase();
  const filtered = rows
    .filter((row) => (filters?.plan ? row.user_plan === filters.plan : true))
    .filter((row) => {
      if (!q) return true;
      return [row.user_email, row.error_code, row.error_message, row.app_version, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const failureDelta = Number(b.status === "failed") - Number(a.status === "failed");
      if (failureDelta) return failureDelta;
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });
  const topErrorCodes = Object.entries(
    filtered.reduce<Record<string, number>>((acc, row) => {
      if (row.error_code) acc[row.error_code] = (acc[row.error_code] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([code, count]) => ({ code, count }));

  return {
    rows: filtered,
    summary: {
      total: filtered.length,
      failed: filtered.filter((row) => row.status === "failed").length,
      succeeded: filtered.filter((row) => row.status === "succeeded").length,
      reused: filtered.filter((row) => row.status === "reused").length,
      topErrorCodes,
    },
  };
}

export async function getAdminOverview() {
  noStore();
  const monthStart = startOfMonthIso();
  const previousMonthStart = startOfPreviousMonthIso();
  const last30 = startOfWindowIso(30);
  const previous30 = startOfWindowIso(60);
  const yesterday = dateRangeToSince("24h");
  const [pageOne, allUsers, subscriptions, usageThisMonth, usageSincePreviousMonth, jobsThisMonth, jobs90d, jobs60d, productEventsThisMonth, feedback, productEvents24h, jobRows] = await Promise.all([
    getAdminUsers({ page: 1 }),
    getAllAdminUserRows(),
    fetchSubscriptions(),
    fetchUsageEvents(undefined, monthStart),
    fetchUsageEvents(undefined, previousMonthStart),
    fetchTranscriptJobs(undefined, monthStart),
    fetchTranscriptJobs(undefined, startOfWindowIso(90)),
    fetchTranscriptJobs(undefined, previous30),
    fetchProductEvents(undefined, monthStart),
    getFeedbackRows({ limit: 1000 }),
    fetchProductEvents(undefined, yesterday),
    fetchTranscriptJobRows({ limit: 1000 }),
  ]);
  const total = pageOne.total;

  const currentSubscriptions = newestSubscriptionByUser(subscriptions);
  const trialUsers = [...currentSubscriptions.values()].filter((sub) => sub.status === "trialing").length;
  const activePaidUsers = [...currentSubscriptions.values()].filter((sub) => sub.status === "active").length;
  const editingSecondsThisMonth = usageThisMonth
    .filter((event) => event.event_type === "transcript_succeeded")
    .reduce((sum, event) => sum + (event.billable_seconds || 0), 0);
  const editingSecondsPreviousMonth = usageSincePreviousMonth
    .filter((event) => event.event_type === "transcript_succeeded" && event.created_at && event.created_at < monthStart)
    .reduce((sum, event) => sum + (event.billable_seconds || 0), 0);
  const reusedJobs = usageThisMonth.filter((event) => event.event_type === "transcript_reused").length;
  const failedJobs =
    jobsThisMonth.filter((job) => job.status === "failed").length +
    productEventsThisMonth.filter((event) => event.event_type === "run_failed").length;
  const current30Jobs = jobs60d.filter((job) => job.created_at && job.created_at >= last30);
  const previous30Jobs = jobs60d.filter((job) => job.created_at && job.created_at < last30);
  const current30Failures = current30Jobs.filter((job) => job.status === "failed").length;
  const previous30Failures = previous30Jobs.filter((job) => job.status === "failed").length;
  const failureRate = current30Jobs.length ? current30Failures / current30Jobs.length : 0;
  const previousFailureRate = previous30Jobs.length ? previous30Failures / previous30Jobs.length : 0;
  const rate = Number(process.env.PYANNOTE_COST_PER_HOUR || "");
  const hasCostRate = Number.isFinite(rate) && rate > 0;
  const jobsByDay = buildJobsByDay(jobs90d);
  const usageByPlan = buildUsageByPlan(allUsers);
  const feedbackByType = countStrings(feedback.map((item) => item.type || "unknown"));
  const feedbackByArea = countStrings(feedback.map((item) => item.product_area || item.ai_category || "unclear"));

  return {
    totalUsers: total,
    trialUsers,
    activePaidUsers,
    editingSecondsThisMonth,
    failedJobs,
    reusedJobs,
    estimatedProviderCost: hasCostRate ? secondsToHours(editingSecondsThisMonth) * rate : null,
    trends: {
      activePaidUsers: { value: activePaidUsers, deltaLabel: "current active" },
      editingTime: { value: editingSecondsThisMonth, previousValue: editingSecondsPreviousMonth },
      failureRate: { value: failureRate, previousValue: previousFailureRate },
    },
    charts: {
      jobsByDay,
      usageByPlan,
      feedbackByType,
      feedbackByArea,
    },
    branchReadyFeedback: feedback.filter((item) => item.status === "branch_ready" || item.codex_ready === true || item.ai_should_be_codex_task === true).length,
    loveSignals: feedback.filter((item) => item.type === "praise").length,
    dataHealth: {
      missingPlan: allUsers.filter((user) => user.subscription_status && !user.plan).length,
      usersWithoutSubscription: allUsers.filter((user) => !user.subscription_status).length,
      jobsMissingDuration: jobRows.filter((job) => job.duration_seconds === null || job.duration_seconds === undefined).length,
      feedbackWithoutType: feedback.filter((item) => !item.type).length,
      productEvents24h: productEvents24h.length,
      webhookGaps: allUsers.filter((user) => user.subscription_status && !user.plan).length,
    },
    stuckSignals: {
      signedUpNeverRan: allUsers.filter((user) => !user.has_run_started && user.successful_jobs === 0 && user.failed_jobs === 0).length,
      importedNeverCompleted: allUsers.filter((user) => user.has_project_imported && !user.has_run_succeeded).length,
      repeatedFailedJobs: allUsers.filter((user) => user.failed_jobs >= 2 || user.run_failed_events >= 2).length,
      ranOnceDidNotReturn: allUsers.filter((user) => user.has_run_succeeded && user.last_active_at && daysSince(user.last_active_at) > 7).length,
      trialNoActivity7d: allUsers.filter((user) => user.subscription_status === "trialing" && user.last_active_at && daysSince(user.last_active_at) > 7).length,
      nearQuota: allUsers.filter((user) => user.signal === "Near quota").length,
    },
  };
}

function buildJobsByDay(jobs: TranscriptJob[]) {
  const days = new Map<string, { date: string; total: number; succeeded: number; failed: number }>();
  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.set(date, { date, total: 0, succeeded: 0, failed: 0 });
  }
  for (const job of jobs) {
    if (!job.created_at) continue;
    const date = job.created_at.slice(0, 10);
    const row = days.get(date);
    if (!row) continue;
    row.total += 1;
    if (job.status === "succeeded") row.succeeded += 1;
    if (job.status === "failed") row.failed += 1;
  }
  return [...days.values()];
}

function buildUsageByPlan(users: AdminUserRow[]) {
  const map = new Map<string, number>();
  for (const user of users) {
    const key = user.plan || "none";
    map.set(key, (map.get(key) || 0) + user.editing_seconds_used);
  }
  return [...map.entries()]
    .map(([label, seconds]) => ({ label, seconds, hours: secondsToHours(seconds) }))
    .sort((a, b) => b.seconds - a.seconds);
}

function countStrings(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function getFeedbackRows(filters?: {
  type?: string;
  severity?: string;
  status?: string;
  branchReady?: boolean;
  q?: string;
  range?: string;
  limit?: number;
}) {
  noStore();
  let query = supabaseAdmin
    .from("feedback_events")
    .select(FEEDBACK_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.type) query = query.eq("type", filters.type);
  if (filters?.severity) query = query.eq("severity", filters.severity);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.branchReady) query = query.or("status.eq.branch_ready,codex_ready.eq.true,ai_should_be_codex_task.eq.true");
  const since = dateRangeToSince(filters?.range);
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query.returns<FeedbackRow[]>();
  if (error) {
    if (isMissingOptionalSchema(error)) return [];
    throw error;
  }

  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean) as string[])];
  const emails = new Map<string, string | null>();
  const subscriptions = userIds.length ? await fetchCurrentSubscriptionMap(userIds) : new Map<string, DbSubscription>();
  if (userIds.length) {
    const { data: users, error: userError } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .in("id", userIds)
      .returns<Array<{ id: string; email: string | null }>>();
    if (userError) throw userError;
    for (const user of users || []) emails.set(user.id, user.email);
  }

  const q = filters?.q?.trim().toLowerCase();
  return (data || []).map((row) => ({
    ...row,
    user_email: row.user_email || (row.user_id ? emails.get(row.user_id) ?? null : null),
    user_plan: row.user_id ? subscriptions.get(row.user_id)?.plan_id ?? null : null,
    user_subscription_status: row.user_id ? subscriptions.get(row.user_id)?.status ?? null : null,
    context_json: sanitizeContext(row.context_json),
  }))
    .filter((row) => {
      if (!q) return true;
      return [row.id, row.user_email, row.type, row.severity, row.status, row.screen, row.title, row.summary, row.message]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => {
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    }) satisfies FeedbackRow[];
}

export async function getNewFeedbackCount() {
  noStore();
  const { count, error } = await supabaseAdmin
    .from("feedback_events")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  if (error) {
    if (isMissingOptionalSchema(error)) return 0;
    throw error;
  }
  return count || 0;
}

export async function getAdminNavCounts() {
  noStore();
  const [newFeedback, branchReady, failedJobs] = await Promise.all([
    supabaseAdmin
      .from("feedback_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabaseAdmin
      .from("feedback_events")
      .select("id", { count: "exact", head: true })
      .or("status.eq.branch_ready,codex_ready.eq.true,ai_should_be_codex_task.eq.true"),
    supabaseAdmin
      .from("transcript_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", startOfMonthIso()),
  ]);

  for (const result of [newFeedback, branchReady, failedJobs]) {
    if (result.error && !isMissingOptionalSchema(result.error)) throw result.error;
  }

  return {
    newFeedback: newFeedback.error ? 0 : newFeedback.count || 0,
    branchReadyFeedback: branchReady.error ? 0 : branchReady.count || 0,
    failedJobs: failedJobs.error ? 0 : failedJobs.count || 0,
    configWarnings: [
      !process.env.PYANNOTE_COST_PER_HOUR ? "Set PYANNOTE_COST_PER_HOUR for cost estimates." : null,
      !process.env.RESEND_API_KEY ? "Set RESEND_API_KEY before sending reviewed nudges or campaigns." : null,
    ].filter(Boolean) as string[],
  };
}

function sanitizeContext(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|secret|password|path|filename|file_name|fcpxml|transcript|audio|provider/i.test(key)) {
      output[key] = "[redacted]";
    } else if (typeof entry === "string") {
      output[key] = sanitizeShortText(entry);
    } else {
      output[key] = entry;
    }
  }
  return output;
}

export async function getFeedbackById(id: string) {
  noStore();
  const { data, error } = await supabaseAdmin
    .from("feedback_events")
    .select("id,status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string }>();
  if (error) throw error;
  return data;
}

export async function updateFeedbackStatus(input: { id: string; status: string; adminUserId: string }) {
  noStore();
  const previous = await getFeedbackById(input.id);
  const { error } = await supabaseAdmin
    .from("feedback_events")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw error;

  const { error: auditError } = await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "feedback_status_updated",
    target_type: "feedback_event",
    target_id: input.id,
    metadata_json: { from: previous?.status ?? null, to: input.status },
  });
  if (auditError) throw auditError;
}

export type FeedbackIntelligenceUpdate = {
  title?: string | null;
  summary?: string | null;
  product_area?: string | null;
  severity?: string;
  admin_priority?: string | null;
  status?: string;
  codex_ready?: boolean;
  suggested_owner?: string | null;
  suggested_branch_name?: string | null;
  reproduction_likelihood?: string | null;
  recommended_next_action?: string | null;
  customer_impact?: string | null;
};

export async function updateFeedbackIntelligence(input: {
  id: string;
  adminUserId: string;
  patch: FeedbackIntelligenceUpdate;
}) {
  noStore();
  const { data: previous, error: previousError } = await supabaseAdmin
    .from("feedback_events")
    .select("id,status,severity,title,summary,product_area,admin_priority,codex_ready,suggested_branch_name")
    .eq("id", input.id)
    .maybeSingle<Record<string, unknown>>();
  if (previousError) throw previousError;

  const update = {
    ...input.patch,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("feedback_events")
    .update(update)
    .eq("id", input.id);
  if (error) throw error;

  const { error: auditError } = await supabaseAdmin.from("admin_events").insert({
    admin_user_id: input.adminUserId,
    action: "feedback_intelligence_updated",
    target_type: "feedback_event",
    target_id: input.id,
    metadata_json: {
      before: previous || null,
      changed_fields: Object.keys(input.patch),
    },
  });
  if (auditError) throw auditError;
}
