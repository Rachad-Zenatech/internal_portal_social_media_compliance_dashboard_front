export interface PostTextEdit {
  id: string;
  reviewer_id: string | null;
  reviewer_name: string;
  created_at: string;
  version: number;
  before_text: string;
  after_text: string;
}

export interface PostTextReview {
  text: string;
  revision: string | null;
  can_edit: boolean;
  edits: PostTextEdit[];
}

export interface PostTextSave {
  text: string;
  base_text: string;
  base_revision: string | null;
}
