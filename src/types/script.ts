import type { StoredCheck } from "@/types/submission";

/** Where a video post's script is: not sent yet, with a reviewer, back with the reviewer's edits, sent back with a
 * note, or approved (the video can be uploaded). */
export type ScriptStatus = "DRAFT" | "IN_REVIEW" | "EDITS_PROPOSED" | "CHANGES_REQUESTED" | "APPROVED";

export interface ScriptVersion {
  version_number: number;
  body: string;
  /** UPLOAD: read from the creator's file. REVIEWER_EDIT / CREATOR_EDIT: edited in the platform. */
  source: "UPLOAD" | "REVIEWER_EDIT" | "CREATOR_EDIT";
  file_name?: string | null;
  check?: StoredCheck | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  /** The reviewer's call on a version the creator sent. */
  review_decision?: "APPROVED" | "EDITED" | "CHANGES_REQUESTED" | null;
  review_note?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
}

/** Where a script sits in the batch it was uploaded with, for stepping through the batch one script at a time. */
export interface ScriptBatchRef {
  batch_id: string;
  title: string;
  /** 1-based place in the batch, and how many scripts it has. */
  position: number;
  total: number;
  /** The posts of the scripts before and after this one. */
  previous_id?: string | null;
  next_id?: string | null;
  /** The next script after this one still waiting for a reviewer (going round the batch). */
  next_waiting_id?: string | null;
  /** How many of the batch's scripts are still waiting for a reviewer. */
  waiting: number;
}

export interface ScriptStage {
  /** Sent, and still being read and scored in the background (it reaches the reviewers when that's done). */
  processing?: boolean;
  /** Why the last send failed, and at which step. */
  send_error?: string | null;
  submission_id: string;
  reference_code: string;
  title: string;
  required: boolean;
  status?: ScriptStatus | null;
  versions: ScriptVersion[];
  /** The uploaded script file, as read now. */
  file_name?: string | null;
  file_status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | null;
  file_error?: string | null;
  file_text?: string | null;
  file_url?: string | null;
  can_submit: boolean;
  can_review: boolean;
  can_respond: boolean;
  /** Set when the script came in a batch of scripts uploaded together. */
  batch?: ScriptBatchRef | null;
  /** The creator's compliance check of the uploaded script, run before sending it. */
  precheck?: StoredCheck | null;
  /** The script, the post's details or the rulebook changed since that check. */
  precheck_stale?: boolean;
  precheck_at?: string | null;
}

export interface ScriptQueueItem {
  id: string;
  reference_code: string;
  title: string;
  platforms: string[];
  brand_code?: string | null;
  audience?: string | null;
  brand_codes?: string[];
  audiences?: string[];
  creator_name?: string | null;
  created_by?: string | null;
  version_number: number;
  sent_at: string;
  score?: number | null;
  /** The AI review couldn't run for this script: no score, a message instead. */
  ai_unavailable?: boolean;
  traffic_light?: "RED" | "YELLOW" | "GREEN" | null;
  approval_needed_by?: string | null;
  /** Set when the script came in a batch (listed with that batch). */
  batch_id?: string | null;
  script_status: "IN_REVIEW" | "CHANGES_REQUESTED" | "EDITS_PROPOSED" | "APPROVED";
  /** When the reviewer decided; null while it waits. */
  decided_at?: string | null;
  can_review: boolean;
}

/** Wording the reviewer highlighted (with an optional note) in a script version. */
export interface ScriptHighlight {
  id: string;
  start: number;
  text: string;
  color: string;
  note: string;
  /** The creator fixed this when they sent the next version, and the wording now reads `updated`. */
  done?: boolean;
  updated?: string | null;
}
