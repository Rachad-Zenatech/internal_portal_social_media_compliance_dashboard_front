/** One model attempt, including its optional document-reading progress. */
export interface CheckAttempt {
  progress_label?: string;
  id: string;
  status: "RUNNING" | "OK" | "FAILED";
  model: string;
  /** Which step of the check made the call, e.g. COMPLIANCE_CHECK or CONTEXT_EVAL. */
  feature: string;
  attempt?: number | null;
  tier?: string | null;
  /** Why it failed: MODEL (retired or unknown), BUSY, QUOTA, KEY or OTHER. */
  error_kind?: string | null;
  error?: string | null;
  duration_ms?: number;
}
