import type { ComplianceCheckResponse } from "@/services/complianceService";

/** AD: paid social ad. Ad-specific fields and rules are still to be defined. */
export type ContentType = "VIDEO" | "SOCIAL_POST" | "CAROUSEL" | "IMAGE" | "BLOG" | "AD";
export type SubmissionFileKind = "MAIN" | "SCRIPT" | "IMAGE" | "SUPPORTING";
export type SubmissionStatus = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED";

export interface BrandOption {
  code: string;
  name: string;
}

export interface AccountOption {
  id: string;
  label: string;
  account_name: string;
  provider: string;
  platform: string;
  handle?: string | null;
  brand_code?: string | null;
  is_ceo: boolean;
  is_demo: boolean;
}

export interface SubmissionOptions {
  brands: BrandOption[];
  accounts: AccountOption[];
  audiences: Record<string, string>;
  regions: string[];
  platforms: string[];
  rule_sets: string[];
  reviewer_routes: string[];
}

/** Who has to act next: the reviewer (REVIEW) or the creator after changes were requested (REVISION). */
export type DueKind = "REVIEW" | "REVISION";

export type TranscriptStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TranscriptSegment {
  start_sec: number;
  end_sec: number;
  text: string;
  /** Said aloud, or text shown in the video. */
  source?: "speech" | "on_screen";
}

export interface SubmissionFile {
  id: string;
  kind: SubmissionFileKind;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string;
  /** Video files only: speech transcript the backend generates after upload. */
  transcript_status?: TranscriptStatus | null;
  transcript?: TranscriptSegment[] | null;
  transcript_error?: string | null;
  /** Scripts and article files: their text is read in the background so the check screens it. Null = not read yet. */
  doc_text_status?: "PROCESSING" | "COMPLETED" | "FAILED" | null;
  /** Why it couldn't be read, in words the creator can act on. */
  doc_text_error?: string | null;
  /** CANVA files remember the design and revision they came from, for "reimport latest". */
  source?: "UPLOAD" | "CANVA";
  canva_design_id?: string | null;
  canva_design_title?: string | null;
  canva_revision?: number | null;
}

/** Which transcript segments contain flagged wording (same matcher as the check). */
export interface SegmentFlag {
  start_sec: number;
  end_sec: number;
  traffic_light: "RED" | "YELLOW" | "GREEN";
  rule_numbers: string[];
}

/** The server's rulebook check: title, caption, and (once ready) the video transcript and the text in its images. */
export type StoredCheck = ComplianceCheckResponse & {
  checked_at?: string;
  includes_transcript?: boolean;
  /** A video whose transcript isn't ready yet; it's re-checked automatically when it is. */
  transcript_pending?: boolean;
  segment_flags?: SegmentFlag[];
  /** The post's images: how many, whose text was read, still being read (re-checked when done), unreadable. */
  images_total?: number;
  images_read?: number;
  images_pending?: number;
  images_failed?: number;
  /** The script (or a blog's article file): whether its text was read into the check, and any still being read or
   * unreadable (with why). */
  includes_script?: boolean;
  documents_total?: number;
  documents_read?: number;
  documents_pending?: number;
  documents_failed?: { name: string; error?: string | null }[];
  /** Still reading the video transcript, the script or the text in images: no score until the post has been read
   * in full. */
  analysis_pending?: boolean;
};

/** One part of the post still being read before the rulebook check can score it. */
export interface AnalysisStep {
  kind: "VIDEO" | "IMAGES" | "DOCUMENTS";
  /** e.g. "Reading the video", "Reading the text in 3 images". */
  label: string;
  /** WAITING: queued, not started yet. RUNNING: being read now. */
  state: "WAITING" | "RUNNING";
  started_at?: string | null;
  expected_seconds: number;
  expected_done_at: string;
}

/** While the check is still reading the post: what's left and when the score is expected. */
export interface AnalysisProgress {
  steps: AnalysisStep[];
  started_at: string;
  expected_done_at: string;
  /** The server's clock when this was made, so the countdown doesn't depend on the viewer's clock. */
  server_time: string;
  /** The estimate comes from how long recent reads took (false while there's too little history). */
  from_history?: boolean;
}

export interface Submission {
  /** The saved check was made before the rulebook last changed. */
  check_outdated?: boolean;
  id: string;
  reference_code: string;
  title: string;
  content_type: ContentType;
  brand_code?: string | null;
  audience?: string | null;
  region?: string | null;
  platforms: string[];
  /** The primary (first) of account_ids / accounts. */
  account_id?: string | null;
  account?: AccountOption | null;
  /** Every account it posts through, primary first. */
  account_ids?: string[];
  accounts?: AccountOption[];
  publish_at?: string | null;
  /** When the creator needs it approved by; the reviewer's deadline once it's submitted. */
  approval_needed_by?: string | null;
  /** When the next step is due (see DueKind). */
  due_at?: string | null;
  due_kind?: DueKind | null;
  caption_html?: string | null;
  caption_text?: string | null;
  rule_sets: string[];
  reviewer_route: string[];
  status: SubmissionStatus;
  current_version: number;
  latest_check?: StoredCheck | null;
  /** While the check is still reading the post: what's left and when the score is expected. */
  analysis_progress?: AnalysisProgress | null;
  files: SubmissionFile[];
  can_edit: boolean;
  /** Drafts: the creator, super admins and Content Managers can delete them. */
  can_delete?: boolean;
  /** In review, and the viewer is a reviewer who may decide on it (not their own upload). */
  can_review?: boolean;
  /** Final approvers named by an approval path; empty means any reviewer on the brand. */
  approver_names?: string[];
  /** The viewer may approve it (a reviewer, and one of its named approvers when it has any). */
  can_approve?: boolean;
  /** Critical flags on the current version that no reviewer has dismissed; approval waits on these. */
  open_critical_flags?: number;
  /** Rulebook score counting only flags nobody has dismissed (null: no score yet), and the least approval needs. */
  approval_score?: number | null;
  min_approval_score?: number;
  /** Approved, and the viewer is a reviewer who may reschedule it or reopen it for changes. */
  can_manage_approval?: boolean;
  created_by?: string | null;
  /** Only filled in when someone other than the creator is viewing. */
  created_by_name?: string | null;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionSummary {
  id: string;
  reference_code: string;
  title: string;
  content_type: ContentType;
  brand_code?: string | null;
  platforms: string[];
  status: SubmissionStatus;
  current_version: number;
  publish_at?: string | null;
  /** When the next step is due (see DueKind). */
  due_at?: string | null;
  due_kind?: DueKind | null;
  latest_traffic_light?: "RED" | "YELLOW" | "GREEN" | null;
  /** Null while the post is still being analysed (analysis_pending). */
  latest_score?: number | null;
  /** How many rulebook issues the latest check found; null while it's still being analysed. */
  issue_count?: number | null;
  analysis_pending?: boolean;
  /** While analysis_pending: what's still being read and when the score is expected. */
  analysis_progress?: AnalysisProgress | null;
  file_count: number;
  /** Review comments across all versions. */
  comment_count?: number;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  audience?: string | null;
  /** Primary publishing channel the post goes to (e.g. Shaun's LinkedIn). */
  account?: AccountOption | null;
  /** Every channel it posts through, primary first. */
  accounts?: AccountOption[];
  /** First 600 characters of the caption. */
  caption_text?: string | null;
  /** Main video/image, or the first attached image, for the card thumbnail. */
  cover?: SubmissionFile | null;
  created_by?: string | null;
  created_by_name?: string | null;
  /** Drafts: the creator, super admins and Content Managers can delete them. */
  can_delete?: boolean;
  /** In review, and the viewer is a reviewer who may decide on it (not their own upload). */
  can_review?: boolean;
  /** Final approvers named by an approval path; empty means any reviewer on the brand. */
  approver_names?: string[];
  /** The viewer may approve it (a reviewer, and one of its named approvers when it has any). */
  can_approve?: boolean;
  /** Critical flags on the current version that no reviewer has dismissed; approval waits on these. */
  open_critical_flags?: number;
  /** Rulebook score counting only flags nobody has dismissed (null: no score yet), and the least approval needs. */
  approval_score?: number | null;
  min_approval_score?: number;
  /** Approved, and the viewer is a reviewer who may reschedule it or reopen it for changes. */
  can_manage_approval?: boolean;
}

export interface SubmissionUpdate {
  title?: string;
  content_type?: ContentType;
  brand_code?: string;
  audience?: string;
  region?: string;
  platforms?: string[];
  account_ids?: string[];
  publish_at?: string;
  approval_needed_by?: string;
  caption_html?: string;
  caption_text?: string;
  rule_sets?: string[];
  reviewer_route?: string[];
  clear_fields?: ("account_id" | "publish_at" | "approval_needed_by" | "brand_code" | "audience" | "region")[];
}

export interface SubmissionVersion {
  version_number: number;
  snapshot: {
    title: string;
    content_type: ContentType;
    brand_code?: string | null;
    audience?: string | null;
    region?: string | null;
    platforms: string[];
    account?: AccountOption | null;
    accounts?: AccountOption[];
    publish_at?: string | null;
    caption_html?: string | null;
    caption_text?: string | null;
    rule_sets: string[];
    reviewer_route: string[];
    files: { id: string; kind: SubmissionFileKind; original_name: string; mime_type: string; size_bytes: number }[];
  };
  created_by_name?: string | null;
  created_at: string;
}

export interface ReviewJob {
  id: string;
  version_number: number;
  status: "AWAITING_REVIEW" | "WITHDRAWN" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | string;
  reviewer_route: string[];
  traffic_light?: "RED" | "YELLOW" | "GREEN" | null;
  score?: number | null;
  automated_check?: StoredCheck | null;
  created_at: string;
  completed_at?: string | null;
  decision?: ReviewDecisionType | null;
  decision_notes?: string | null;
  decided_by_name?: string | null;
  decided_at?: string | null;
  /** Approved: the rules the reviewer confirmed by hand. */
  manual_checks?: { rule_number: string; title: string }[];
}

export type ReviewDecisionType = "APPROVE" | "REQUEST_CHANGES";

export interface ReviewDecisionRequest {
  decision: ReviewDecisionType;
  /** Shown to the creator; required for changes unless there are open comments. */
  notes?: string;
  /** Approve: schedule for this time (defaults to the planned publish date)... */
  publish_at?: string;
  /** ...or approve to publish straight away. */
  publish_now?: boolean;
  /** Approve: the rules (by number) the reviewer confirmed by hand; must cover the check's manual_review_rules. */
  confirmed_rules?: string[];
  /** Request changes: working days the creator has to resubmit. */
  revision_days?: 1 | 2 | 3 | 5;
}

export type ReviewCommentCategory = "LEGAL" | "EDITORIAL" | "COMPLIANCE" | "BRAND" | "NOTE";

export interface ReviewComment {
  id: string;
  submission_id: string;
  version_number: number;
  category: ReviewCommentCategory;
  body: string;
  start_sec?: number | null;
  end_sec?: number | null;
  author_id?: string | null;
  author_name?: string | null;
  /** Written by a reviewer rather than the creator. */
  from_reviewer: boolean;
  resolved_at?: string | null;
  resolved_by_name?: string | null;
  created_at: string;
  can_delete: boolean;
}

export interface ReviewCommentCreate {
  body: string;
  category?: ReviewCommentCategory;
  start_sec?: number | null;
  end_sec?: number | null;
}

export interface SubmissionEvent {
  id: number;
  event_type: string;
  message: string;
  data?: Record<string, unknown> | null;
  actor_name?: string | null;
  created_at: string;
}

export interface SubmissionHistory {
  versions: SubmissionVersion[];
  review_jobs: ReviewJob[];
  events: SubmissionEvent[];
}

export interface ReviewQueueItem {
  id: string;
  reference_code: string;
  title: string;
  status: SubmissionStatus;
  platforms: string[];
  account?: AccountOption | null;
  caption_text?: string | null;
  latest_check?: StoredCheck | null;
  /** While the check is still reading the post: what's left and when the score is expected. */
  analysis_progress?: AnalysisProgress | null;
  current_version: number;
  submitted_at?: string | null;
  creator_name?: string | null;
  content_type?: ContentType | null;
  /** The post's video, when it has one. */
  video?: SubmissionFile | null;
  /** Its images in order (carousel slides first, then extras such as a cover). */
  images?: SubmissionFile[];
  can_review?: boolean;
  /** Final approvers named by an approval path; empty means any reviewer on the brand. */
  approver_names?: string[];
  /** The viewer may approve it (a reviewer, and one of its named approvers when it has any). */
  can_approve?: boolean;
  /** Critical flags on the current version that no reviewer has dismissed; approval waits on these. */
  open_critical_flags?: number;
  /** Rulebook score counting only flags nobody has dismissed (null: no score yet), and the least approval needs. */
  approval_score?: number | null;
  min_approval_score?: number;
  publish_at?: string | null;
  brand_code?: string | null;
  audience?: string | null;
  /** When the creator needs it approved by. */
  approval_needed_by?: string | null;
  /** When the next step is due (see DueKind). */
  due_at?: string | null;
  due_kind?: DueKind | null;
  created_by?: string | null;
  /** Approved: the viewer is a reviewer who may reschedule or reopen it. */
  can_manage_approval?: boolean;
  /** When the latest version was approved or sent back. */
  decided_at?: string | null;
}

/** One submitted version as it was: what was sent, its video, its automated check and its decision. */
export interface VersionView {
  version_number: number;
  latest_version: number;
  snapshot: {
    title?: string;
    caption_text?: string | null;
    platforms?: string[];
    publish_at?: string | null;
    [key: string]: unknown;
  };
  created_at: string;
  created_by_name?: string | null;
  video?: SubmissionFile | null;
  check?: StoredCheck | null;
  review_job?: ReviewJob | null;
}

export type FlagDismissReason = "NEGATED" | "DIFFERENT_MEANING" | "ACCEPTABLE_IN_CONTEXT" | "RULE_TOO_BROAD" | "OTHER";

/** A reviewer's dismissal of an automated compliance flag on one version. */
export interface FlagReview {
  rule_id: string;
  rule_number: string;
  version_number: number;
  flagged_terms: string[];
  traffic_light: string;
  reason: FlagDismissReason;
  reason_label: string;
  note?: string | null;
  decided_by_name?: string | null;
  decided_at: string;
}

/** Per rule: how many submitted versions it flagged and how many of those flags reviewers dismissed. */
export interface RuleFlagStats {
  rule_number: string;
  flagged: number;
  dismissed: number;
  dismissal_rate?: number | null;
  top_reason?: string | null;
  top_reason_label?: string | null;
}

/** The Content Screener's tabs: waiting on a reviewer, waiting on the creator, decided (last 30 days). */
export type QueueTab = "review" | "sent_back" | "done";

export type ReviewQueueCounts = Record<QueueTab, number>;

/** The dashboard's activity feed and last-30-days insights (GET /api/submissions/dashboard). */
export interface DashboardSummary {
  activity: {
    at: string;
    actor_id?: string | null;
    actor_name?: string | null;
    /** e.g. "approved", "requested changes on", "commented on" */
    action: string;
    submission_id: string;
    reference_code: string;
    title: string;
  }[];
  reviews_completed: number;
  approved: number;
  changes_requested: number;
  /** Waiting on a reviewer past its review deadline, right now. */
  overdue_reviews: number;
  /** Average rulebook score of content sent for review in the period; null when nothing was sent. */
  average_score?: number | null;
  common_findings: { rule_number: string; title: string; count: number }[];
  days: number;
}

export interface SubmitResult {
  submission: Submission;
  review_job: ReviewJob;
}
