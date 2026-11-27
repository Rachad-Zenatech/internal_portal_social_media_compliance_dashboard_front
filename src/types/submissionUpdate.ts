import type { ContentType } from "@/types/submission";
import type { SubmissionSourceFields } from "@/types/sourceLink";
import type { VideoScriptOptions } from "@/types/videoScript";

export interface SubmissionUpdate extends SubmissionSourceFields, VideoScriptOptions {
  title?: string;
  content_type?: ContentType;
  brand_code?: string;
  audience?: string;
  /** Every brand and audience, primary first. brand_code and audience alone still work. */
  brand_codes?: string[];
  audiences?: string[];
  region?: string;
  platforms?: string[];
  account_ids?: string[];
  publish_at?: string;
  approval_needed_by?: string;
  caption_html?: string;
  caption_text?: string;
  /** Messaging Context chosen for the analysis, by kind (entry ids); a kind left out is automatic. */
  context_picks?: Record<string, string[]>;
  ai_generated_images?: boolean; people_in_images?: boolean; employee_in_images?: boolean; face_employee_flags?: Record<string, boolean>;
  video_third_party_footage?: boolean | null;
  platform_captions?: Record<string, string>;
  rule_sets?: string[];
  reviewer_route?: string[];
  reviewer_ids?: string[];
  clear_fields?: ("account_id" | "publish_at" | "approval_needed_by" | "brand_code" | "audience" | "region")[];
}
