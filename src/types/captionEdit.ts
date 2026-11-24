export interface CaptionRevision {
  id: number;
  before: string;
  after: string;
  platform: string | null;
  version: number;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
}

export interface CaptionReview {
  caption_text: string;
  caption_html?: string | null;
  platform_captions: Record<string, string>;
  platforms: string[];
  can_edit: boolean;
  needs_recheck?: boolean;
  revisions: CaptionRevision[];
}

export interface CaptionEditRequest {
  base_caption: string;
  caption_text: string;
  platform: string | null;
}
