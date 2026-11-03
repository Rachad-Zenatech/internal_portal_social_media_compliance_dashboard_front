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
}

/** What a platform's API lets us create from an approved post. */
export type PublishMode = "PUBLISH_NOW" | "SCHEDULED" | "DRAFT_ON_PLATFORM";

export interface PlatformPublishInfo {
  platform: string;
  allowed_modes: PublishMode[];
  requires_media: boolean;
  max_characters?: number;
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
}
