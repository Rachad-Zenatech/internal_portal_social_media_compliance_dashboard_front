import type { ComplianceCheckResponse } from "@/services/complianceService";

export type ContentType = "VIDEO" | "SOCIAL_POST" | "CAROUSEL" | "IMAGE" | "BLOG";
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

export type TranscriptStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface TranscriptSegment {
  start_sec: number;
  end_sec: number;
  text: string;
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
}

export type StoredCheck = ComplianceCheckResponse & { checked_at?: string };

export interface Submission {
  id: string;
  reference_code: string;
  title: string;
  content_type: ContentType;
  brand_code?: string | null;
  audience?: string | null;
  region?: string | null;
  platforms: string[];
  account_id?: string | null;
  account?: AccountOption | null;
  publish_at?: string | null;
  caption_html?: string | null;
  caption_text?: string | null;
  rule_sets: string[];
  reviewer_route: string[];
  status: SubmissionStatus;
  current_version: number;
  latest_check?: StoredCheck | null;
  files: SubmissionFile[];
  can_edit: boolean;
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
  latest_traffic_light?: "RED" | "YELLOW" | "GREEN" | null;
  latest_score?: number | null;
  file_count: number;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
  audience?: string | null;
  /** Publishing channel the post goes to (e.g. Shaun's LinkedIn). */
  account?: AccountOption | null;
  /** First 600 characters of the caption. */
  caption_text?: string | null;
  /** Main video/image, or the first attached image, for the card thumbnail. */
  cover?: SubmissionFile | null;
}

export interface SubmissionUpdate {
  title?: string;
  content_type?: ContentType;
  brand_code?: string;
  audience?: string;
  region?: string;
  platforms?: string[];
  account_id?: string;
  publish_at?: string;
  caption_html?: string;
  caption_text?: string;
  rule_sets?: string[];
  reviewer_route?: string[];
  clear_fields?: ("account_id" | "publish_at" | "brand_code" | "audience" | "region")[];
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
  current_version: number;
  submitted_at?: string | null;
  creator_name?: string | null;
  video: SubmissionFile;
}

export interface SubmitResult {
  submission: Submission;
  review_job: ReviewJob;
}
