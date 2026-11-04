import type { PosterVariant } from "@/context/VideoUploadQueueContext";
import type { AccountOption, ContentType, SubmissionFile } from "@/types/submission";

/**
 * Publishing calendar types: scheduled and approved content across channels,
 * publish modes (scheduled vs immediate vs draft), and platform records.
 */

/** Approved content placed on the publishing calendar. */
export interface CalendarItem {
  id: string;
  /** "sample" items are mock examples shown when there are no real items yet. */
  is_sample?: boolean;
  reference_code: string;
  title: string;
  brand_code: string;
  scheduled_for: string;
  publish_mode: PublishMode;
  account_id?: string | null;
  account?: AccountOption | null;
  primary_file?: SubmissionFile | null;
  content_type: ContentType;
  primary_platform: string;
  poster_variant?: PosterVariant;
  /** The post's copy. */
  caption: string;
  /** Every platform it goes to; primary_platform is the first. */
  platforms: string[];
  /** The rulebook score it was approved with. */
  score?: number | null;
  approved_by?: string | null;
  /** The approved submission this item comes from (absent for sample items). */
  submission_id?: string;
}

/** What a platform's API lets us create from an approved post. */
export type PublishMode = "PUBLISH_NOW" | "SCHEDULED" | "DRAFT_ON_PLATFORM";

/**
 * How the publish step is worded on screen. Not every API supports true drafts, so some posts become a private
 * upload, a scheduled post or a ready-to-post package; all but SCHEDULED are a DRAFT_ON_PLATFORM mode.
 */
export type PublishStyle = "DRAFT" | "PRIVATE_UPLOAD" | "SCHEDULED" | "HANDOFF";

export interface PlatformPublishInfo {
  platform: string;
  allowed_modes: PublishMode[];
  requires_media: boolean;
  max_characters?: number;
  /** How publishing is worded for this platform. */
  style: PublishStyle;
  /** Button text, e.g. "Create LinkedIn draft". */
  action: string;
  /** What exists once it's done. */
  result: string;
  /** Why it works this way on this platform. */
  note: string;
}

export interface PublishRecord {
  id: string;
  submission_id: string;
  platform: string;
  mode: PublishMode;
  status: "PENDING" | "SCHEDULED" | "PUBLISHED" | "FAILED";
  remote_post_id?: string;
  scheduled_for?: string;
  published_at?: string;
  error?: string;
  created_at: string;
  /** How it was worded when it was created (draft, private upload, ...). */
  style?: PublishStyle;
}
