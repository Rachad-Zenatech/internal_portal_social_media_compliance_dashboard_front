import type { StoredCheck } from "@/types/submission";

/** Several scripts uploaded in one document, reviewed together; each approved one becomes a post (see the backend's script_batch_service). */
export type BatchStatus = "DRAFT" | "PROCESSING" | "IN_REVIEW" | "CHANGES_REQUESTED" | "DONE";
export type BatchItemStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";

/** What every post made from the batch shares. */
export interface BatchDetails {
  brand_codes?: string[];
  audiences?: string[];
  region?: string | null;
  platforms?: string[];
  account_ids?: string[];
  rule_sets?: string[];
  /** ISO time: when the creator needs the scripts approved by. */
  approval_needed_by?: string | null;
  reviewer_ids?: string[];
}

export interface BatchItem {
  id: string;
  position: number;
  title: string;
  body: string;
  status: BatchItemStatus;
  check?: StoredCheck | null;
  /** Not sent yet: the script or its details changed since the creator's check. */
  check_stale?: boolean;
  review_note?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  /** The post made from it once approved. */
  submission_id?: string | null;
  reference_code?: string | null;
  /** The details its post gets: its own when the batch sets them per script, else the batch's. */
  details: BatchDetails;
  /** What is still missing from them (per-script batches only). */
  missing_details: string[];
}

export interface Batch {
  id: string;
  title: string;
  source_name?: string | null;
  status: BatchStatus;
  created_by: string;
  created_by_name?: string | null;
  details: BatchDetails;
  /** One set of details for every script (false), or each script has its own (true). */
  per_script_details: boolean;
  /** The shared details still missing before it can be sent, by their names on the form. */
  missing_details: string[];
  items: BatchItem[];
  error?: string | null;
  sent_at?: string | null;
  created_at: string;
  /** The details form: until the batch is first sent. */
  can_edit: boolean;
  /** Edit, add or remove scripts that haven't been sent yet. */
  can_change_scripts: boolean;
  can_send: boolean;
  can_review: boolean;
}

export interface BatchSummary {
  id: string;
  title: string;
  status: BatchStatus;
  created_by: string;
  created_by_name?: string | null;
  total: number;
  in_review: number;
  approved: number;
  changes_requested: number;
  sent_at?: string | null;
  created_at: string;
}

export interface ItemDecision {
  item_id: string;
  decision: "APPROVE" | "SEND_BACK";
  note?: string;
}

export interface ItemResult {
  item_id: string;
  ok: boolean;
  /** APPROVED (a post was made), SENT_BACK, or why it was skipped. */
  outcome: string;
  submission_id?: string | null;
  reference_code?: string | null;
}

export interface BatchReviewResult {
  batch: Batch;
  results: ItemResult[];
}
