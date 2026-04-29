import { unstable_noStore as noStore } from "next/cache";

import type { AdminUserRow, FeedbackRow } from "@/lib/admin/data";
import { getAllAdminUserRows, getFeedbackRows } from "@/lib/admin/data";

export type SegmentKey =
  | "trial_never_ran"
  | "imported_not_completed"
  | "failed_twice"
  | "ran_once_not_returned"
  | "near_quota"
  | "heavy_user"
  | "trial_exhausted"
  | "paid_user_near_limit"
  | "positive_feedback"
  | "branch_ready_feedback"
  | "cancellation_risk";

export type SegmentDefinition = {
  key: SegmentKey;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  nextAction: string;
};

export type SegmentUserRow = AdminUserRow & {
  segment: SegmentDefinition;
  reason: string;
  suggestedNextAction: string;
  stuckScore: number;
  churnRiskScore: number;
  loveScore: number;
  heavyUserScore: number;
};

const SEGMENTS: SegmentDefinition[] = [
  {
    key: "trial_never_ran",
    slug: "trial-never-ran",
    title: "Trial users who never ran",
    shortTitle: "Trial never ran",
    description: "Trial users who have not started a CutSwitch run yet.",
    nextAction: "Help them reach first value with a simple first-run nudge.",
  },
  {
    key: "imported_not_completed",
    slug: "imported-not-completed",
    title: "Imported but never completed",
    shortTitle: "Imported, no complete",
    description: "Users who imported a project but have no successful run.",
    nextAction: "Look for onboarding friction or failed setup before nudging.",
  },
  {
    key: "failed_twice",
    slug: "failed-twice",
    title: "Failed jobs twice or more",
    shortTitle: "Failed twice",
    description: "Users with repeated failures across jobs or run events.",
    nextAction: "Treat as support rescue before they silently churn.",
  },
  {
    key: "near_quota",
    slug: "near-quota",
    title: "Near quota",
    shortTitle: "Near quota",
    description: "Users close to their editing-time allowance.",
    nextAction: "Prepare an upgrade or workflow planning nudge.",
  },
  {
    key: "heavy_user",
    slug: "heavy-users",
    title: "Heavy users",
    shortTitle: "Heavy users",
    description: "High editing-time or repeat-success users.",
    nextAction: "Consider upgrade, interview, or testimonial outreach.",
  },
  {
    key: "positive_feedback",
    slug: "love-signals",
    title: "Positive feedback / love signals",
    shortTitle: "Love signals",
    description: "Users who sent praise or show strong product fit.",
    nextAction: "Consider asking for a quote or deeper workflow call.",
  },
  {
    key: "trial_exhausted",
    slug: "trial-exhausted",
    title: "Trial exhausted",
    shortTitle: "Trial exhausted",
    description: "Trial users with no editing time remaining.",
    nextAction: "Prepare a calm upgrade nudge.",
  },
  {
    key: "ran_once_not_returned",
    slug: "ran-once-not-returned",
    title: "Ran once but did not return",
    shortTitle: "One-and-done",
    description: "Users with a successful run but no recent activity.",
    nextAction: "Ask what stopped the second run.",
  },
  {
    key: "paid_user_near_limit",
    slug: "paid-user-near-limit",
    title: "Paid users near limit",
    shortTitle: "Paid near limit",
    description: "Active paid users close to their editing-time limit.",
    nextAction: "Prepare a plan-fit or upgrade conversation.",
  },
  {
    key: "branch_ready_feedback",
    slug: "branch-ready-feedback",
    title: "Branch-ready feedback",
    shortTitle: "Branch-ready",
    description: "Users with feedback ready to become a focused task.",
    nextAction: "Convert the clearest reports into Codex/app tasks.",
  },
  {
    key: "cancellation_risk",
    slug: "cancellation-risk",
    title: "Cancellation risk",
    shortTitle: "Churn risk",
    description: "Users showing failure, inactivity, low-time, or billing risk signals.",
    nextAction: "Review context before sending any nudge.",
  },
];

export function getSegmentDefinitions() {
  return SEGMENTS;
}

export function getSegmentDefinition(slugOrKey: string) {
  return SEGMENTS.find((segment) => segment.slug === slugOrKey || segment.key === slugOrKey);
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function feedbackByUser(feedback: FeedbackRow[]) {
  const map = new Map<string, FeedbackRow[]>();
  for (const item of feedback) {
    if (!item.user_id) continue;
    map.set(item.user_id, [...(map.get(item.user_id) || []), item]);
  }
  return map;
}

function isNearQuota(user: AdminUserRow) {
  if (user.editing_seconds_remaining === null) return false;
  return user.signal === "Near quota" || user.editing_seconds_remaining <= 1800;
}

function isTrialInactive(user: AdminUserRow) {
  return user.subscription_status === "trialing" && !user.has_run_succeeded && daysSince(user.last_active_at) >= 3;
}

function scoresFor(user: AdminUserRow, userFeedback: FeedbackRow[]) {
  const hasConfusion = userFeedback.some((item) => item.type === "confusion");
  const hasPraise = userFeedback.some((item) => item.type === "praise");
  const lowFailureRate = user.successful_jobs >= 3 && user.failed_jobs === 0;
  const nearQuota = isNearQuota(user);
  const inactive7d = daysSince(user.last_active_at) > 7;

  const stuckScore =
    (user.has_project_imported && !user.has_run_succeeded ? 40 : 0) +
    (user.failed_jobs > 0 || user.run_failed_events > 0 ? 30 : 0) +
    (isTrialInactive(user) ? 20 : 0) +
    (hasConfusion ? 10 : 0);

  const churnRiskScore =
    (user.subscription_status === "trialing" && !user.has_run_succeeded && daysSince(user.created_at) >= 5 ? 30 : 0) +
    (user.failed_jobs >= 2 || user.run_failed_events >= 2 ? 30 : 0) +
    (inactive7d ? 20 : 0) +
    (nearQuota ? 20 : 0) +
    (["canceled", "past_due", "unpaid"].includes(user.subscription_status || "") ? 40 : 0);

  const loveScore =
    (hasPraise ? 40 : 0) +
    (user.successful_jobs >= 3 ? 30 : 0) +
    (user.last_product_event === "transcript_reused" ? 20 : 0) +
    (lowFailureRate ? 10 : 0);

  const heavyUserScore = Math.min(100, Math.round((user.editing_seconds_used / 36000) * 60 + Math.min(user.successful_jobs, 10) * 4));

  return {
    stuckScore: Math.min(100, stuckScore),
    churnRiskScore: Math.min(100, churnRiskScore),
    loveScore: Math.min(100, loveScore),
    heavyUserScore,
  };
}

function reasonFor(segment: SegmentDefinition, user: AdminUserRow) {
  switch (segment.key) {
    case "trial_never_ran":
      return "Trialing with no run started.";
    case "imported_not_completed":
      return "Project imported, but no successful run recorded.";
    case "failed_twice":
      return `${user.failed_jobs + user.run_failed_events} failure signals recorded.`;
    case "ran_once_not_returned":
      return `Last active ${Math.floor(daysSince(user.last_active_at))} days ago after a successful run.`;
    case "near_quota":
      return `${Math.max(0, user.editing_seconds_remaining || 0)} editing seconds remaining.`;
    case "heavy_user":
      return `${Math.round(user.editing_seconds_used / 3600)} editing hours used and ${user.successful_jobs} successful jobs.`;
    case "trial_exhausted":
      return "Trial editing time is exhausted.";
    case "paid_user_near_limit":
      return "Active paid user close to editing-time allowance.";
    case "positive_feedback":
      return "Praise feedback or strong success pattern.";
    case "branch_ready_feedback":
      return "Feedback is marked branch-ready or Codex-task ready.";
    case "cancellation_risk":
      return "Inactivity, repeated failure, low remaining time, or billing risk.";
  }
}

function userInSegment(segment: SegmentDefinition, user: AdminUserRow, userFeedback: FeedbackRow[], scores: ReturnType<typeof scoresFor>) {
  const hasPraise = userFeedback.some((item) => item.type === "praise");
  const hasBranchReady = userFeedback.some((item) => item.status === "branch_ready" || item.codex_ready === true || item.ai_should_be_codex_task === true);

  switch (segment.key) {
    case "trial_never_ran":
      return user.subscription_status === "trialing" && !user.has_run_started && user.successful_jobs === 0;
    case "imported_not_completed":
      return user.has_project_imported && !user.has_run_succeeded;
    case "failed_twice":
      return user.failed_jobs >= 2 || user.run_failed_events >= 2;
    case "ran_once_not_returned":
      return user.has_run_succeeded && daysSince(user.last_active_at) > 7;
    case "near_quota":
      return isNearQuota(user);
    case "heavy_user":
      return user.signal === "Heavy user" || user.editing_seconds_used >= 10 * 3600 || user.successful_jobs >= 5;
    case "trial_exhausted":
      return user.subscription_status === "trialing" && user.editing_seconds_remaining !== null && user.editing_seconds_remaining <= 0;
    case "paid_user_near_limit":
      return user.subscription_status === "active" && isNearQuota(user);
    case "positive_feedback":
      return hasPraise || scores.loveScore >= 60;
    case "branch_ready_feedback":
      return hasBranchReady;
    case "cancellation_risk":
      return scores.churnRiskScore >= 50;
  }
}

async function buildSegmentRows() {
  noStore();
  const [users, feedback] = await Promise.all([
    getAllAdminUserRows(),
    getFeedbackRows({ limit: 1000 }),
  ]);
  const feedbackMap = feedbackByUser(feedback);

  return SEGMENTS.map((segment) => {
    const rows = users
      .map((user) => {
        const userFeedback = feedbackMap.get(user.id) || [];
        const scores = scoresFor(user, userFeedback);
        if (!userInSegment(segment, user, userFeedback, scores)) return null;
        return {
          ...user,
          segment,
          reason: reasonFor(segment, user),
          suggestedNextAction: segment.nextAction,
          ...scores,
        } satisfies SegmentUserRow;
      })
      .filter(Boolean) as SegmentUserRow[];

    return {
      segment,
      rows: rows.sort((a, b) => {
        if (segment.key === "positive_feedback") return b.loveScore - a.loveScore;
        if (segment.key === "heavy_user") return b.heavyUserScore - a.heavyUserScore;
        return b.churnRiskScore + b.stuckScore - (a.churnRiskScore + a.stuckScore);
      }),
    };
  });
}

export async function getAdminSegments() {
  const segmentRows = await buildSegmentRows();
  return segmentRows.map(({ segment, rows }) => ({
    ...segment,
    count: rows.length,
    rows,
  }));
}

export async function getAdminSegment(slug: string) {
  const definition = getSegmentDefinition(slug);
  if (!definition) return null;
  const segments = await buildSegmentRows();
  return segments.find((segment) => segment.segment.key === definition.key) || null;
}
