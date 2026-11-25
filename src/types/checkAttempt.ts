/** One model attempt, including its optional document-reading progress. */
export interface CheckAttempt {
  progress_label?: string;
  /** Stable identity of one task across its retries; not the model name. */
  task_id?: string;
  task_kind?: "CLAIM_EXTRACTION" | "SOURCE_COMPARISON";
  source_title?: string;
  claim_count?: number;
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
