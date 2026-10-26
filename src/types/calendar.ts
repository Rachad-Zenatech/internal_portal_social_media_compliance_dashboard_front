import type { PosterVariant } from "@/context/VideoUploadQueueContext";
import type { AccountOption, ContentType, SubmissionFile } from "@/types/submission";

/** Approved content placed on the publishing calendar. */
export interface CalendarItem {
  id: string;
  /** "sample" items are mock data until real approvals and platform APIs are in place. */
  source: "sample" | "submission";
  referenceCode: string;
  title: string;
  caption: string;
  contentType: ContentType;
  platforms: string[];
  account: AccountOption | null;
  publishAt: string;
  /** Brand code, from the same brands list as New Submission (e.g. "ZENATECH"). */
  brand: string;
  score: number | null;
  approvedBy?: string | null;
  /** Illustration for sample items with no real media. */
  poster?: PosterVariant;
  media?: SubmissionFile | null;
  submissionId?: string;
}

/** What a platform's API lets us create from an approved post. */
export type PublishMode = "DRAFT" | "PRIVATE_UPLOAD" | "SCHEDULED" | "HANDOFF";

export interface PlatformPublishInfo {
  mode: PublishMode;
  /** Button text, e.g. "Create LinkedIn draft". */
  action: string;
  /** What exists once it's done. */
  result: string;
  /** Why it works this way on this platform. */
  note: string;
  captionLimit: number;
}

export interface PublishRecord {
  mode: PublishMode;
  at: string;
  /** Mock reference for the created draft or package. */
  ref: string;
}
