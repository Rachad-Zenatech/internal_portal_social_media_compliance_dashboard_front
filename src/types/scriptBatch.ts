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
  review_note?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  /** The post made from it once approved. */
  submission_id?: string | null;
  reference_code?: string | null;
}

export interface Batch {
  id: string;
  title: string;
  source_name?: string | null;
  status: BatchStatus;
  created_by: string;
  created_by_name?: string | null;
  details: BatchDetails;
  /** The details still missing before it can be sent, by their names on the form. */
  missing_details: string[];
  items: BatchItem[];
  error?: string | null;
  sent_at?: string | null;
  created_at: string;
  can_edit: boolean;
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
