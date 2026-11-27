export interface CaptionRevision {
  before_html?: string | null;
  after_html?: string | null;
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
  caption_html?: string | null;
  base_caption_html?: string | null;
  base_caption: string;
  caption_text: string;
  platform: string | null;
}
