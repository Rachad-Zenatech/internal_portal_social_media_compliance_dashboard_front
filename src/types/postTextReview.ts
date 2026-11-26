export interface PostTextEdit {
  before_html?: string | null;
  after_html?: string | null;
  id: string;
  reviewer_id: string | null;
  reviewer_name: string;
  created_at: string;
  version: number;
  before_text: string;
  after_text: string;
}

export interface PostTextReview {
  html?: string | null;
  text: string;
  revision: string | null;
  can_edit: boolean;
  edits: PostTextEdit[];
}

export interface PostTextSave {
  html?: string | null;
  base_html?: string | null;
  text: string;
  base_text: string;
  base_revision: string | null;
}
