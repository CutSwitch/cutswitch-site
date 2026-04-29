export const PRODUCT_EVENT_TYPES = [
  "app_opened",
  "signed_in",
  "project_imported",
  "speaker_count_confirmed",
  "run_clicked",
  "run_blocked_no_plan",
  "run_blocked_insufficient_time",
  "run_started",
  "run_succeeded",
  "run_failed",
  "transcript_reused",
  "export_created",
  "feedback_opened",
  "feedback_submitted",
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

export function isProductEventType(value: unknown): value is ProductEventType {
  return PRODUCT_EVENT_TYPES.includes(value as ProductEventType);
}
