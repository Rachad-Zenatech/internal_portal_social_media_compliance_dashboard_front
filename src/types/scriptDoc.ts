import type { BatchDetails } from "@/types/scriptBatch";

export type DocStatus = "DRAFT" | "IN_REVIEW" | "LEVEL2_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
export type Capacity = "EDIT" | "VIEW";
export type Vote = "APPROVE" | "CHANGES" | "DONE";

export interface ScriptTemplate {
  key: string;
  name: string;
  storyline: string;
  description: string;
  duration: string;
  rows: { time: string; visual: string; voiceover: string; onscreen: string }[];
}

export interface DocReviewer {
  user_id: string;
  name: string;
  capacity: Capacity;
  can_approve: boolean;
  color: string;
  checked_in: boolean;
  vote: Vote | null;
  note: string | null;
  checked_at: string | null;
}

export interface DocAccess {
  role: "CREATOR" | "MANAGER" | "REVIEWER" | "SUGGESTER" | "VIEWER";
  can_edit: boolean;
  can_note: boolean;
  can_submit: boolean;
  can_check_in: boolean;
  can_finalize: boolean;
  can_decide: boolean;
  can_delete: boolean;
}

export type DocDetails = BatchDetails;

/** A post made from one script of an approved document. */
export interface DocPost {
  position: number;
  title: string;
  submission_id: string | null;
  reference_code: string | null;
}

export interface DocDetail {
  id: string;
  /** Set when the script is edited in the Share Document portal's editor (shown in an iframe) instead of this portal's. */
  share_document_id?: string | null;
  title: string;
  template_key: string;
  status: DocStatus;
  round: number;
  creator_id: string;
  creator_name: string | null;
  creator_color: string;
  body_html: string;
  body_text: string;
  details: DocDetails;
  send_note: string | null;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  reviewers: DocReviewer[];
  /** What is still empty in the details, by name. */
  missing_details: string[];
  /** The document this script is a page of, and its pages (for the creator and Content Managers). */
  set_id: string | null;
  set_title: string | null;
  pages: DocPage[];
  /** The post made from the script once it is approved. */
  posts: DocPost[];
  all_checked: boolean;
  access: DocAccess;
  my_color: string;
  updated_at: string;
  created_at: string;
}

/** One script (page) of a creator's document. */
export interface DocPage {
  id: string;
  title: string;
  status: DocStatus;
  position: number;
  round: number;
  checked_in: number;
  required: number;
}

/** A creator's document in the hub. */
export interface DocSetSummary {
  id: string;
  title: string;
  first_script_id: string;
  total: number;
  draft: number;
  in_review: number;
  changes_requested: number;
  approved: number;
  needs_you: boolean;
  updated_at: string;
}

export interface BulkResult {
  sent: number;
  failed: { id: string; title: string; reason: string }[];
}

export interface DocSummary {
  id: string;
  title: string;
  template_key: string;
  status: DocStatus;
  round: number;
  creator_id: string;
  creator_name: string | null;
  reviewer_names: string[];
  checked_in: number;
  required: number;
  needs_you: boolean;
  updated_at: string;
  created_at: string;
}

export interface DocEvent {
  id: number;
  round: number;
  user_name: string | null;
  kind: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface DocVersion {
  id: number;
  round: number;
  label: string;
  body_html: string;
  body_text: string;
  created_by_name: string | null;
  created_at: string;
}

export interface DocHistory {
  events: DocEvent[];
  versions: DocVersion[];
}

export interface ReviewerOption {
  id: string;
  name: string;
  email: string;
  is_super_admin: boolean;
  kind: "REVIEWER" | "SUGGESTER";
}

/** What every open editor is told as the review moves (see the backend's script_doc_service._state). */
export interface DocLiveState {
  status: DocStatus;
  round: number;
  all_checked: boolean;
  checkins: { user_id: string; name: string; vote: Vote }[];
  changed_by: { user_id: string; name: string | null; channel: string } | null;
  you?: { can_edit: boolean; can_note: boolean };
}

/** A highlight or comment on a stretch of the script, shared live through the notes document. */
export interface DocNote {
  id: string;
  kind: "highlight" | "comment";
  quote: string;
  /** Where the wording started when the note was made; it is found again by its wording if the text moved. */
  start: number;
  text: string;
  color: string;
  author_id: string;
  author_name: string;
  created_at: string;
  resolved: boolean;
  replies: { author_name: string; text: string; created_at: string }[];
}
