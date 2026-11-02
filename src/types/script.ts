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

export interface ScriptStage {
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
  can_submit: boolean;
  can_review: boolean;
  can_respond: boolean;
}

export interface ScriptQueueItem {
  id: string;
  reference_code: string;
  title: string;
  platforms: string[];
  brand_code?: string | null;
  audience?: string | null;
  creator_name?: string | null;
  created_by?: string | null;
  version_number: number;
  sent_at: string;
  score?: number | null;
  traffic_light?: "RED" | "YELLOW" | "GREEN" | null;
  approval_needed_by?: string | null;
  script_status: "IN_REVIEW" | "CHANGES_REQUESTED" | "EDITS_PROPOSED" | "APPROVED";
  /** When the reviewer decided; null while it waits. */
  decided_at?: string | null;
  can_review: boolean;
}
