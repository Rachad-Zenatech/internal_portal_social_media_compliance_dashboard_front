export interface ReviewTextValue { text: string; html: string | null; }

/** Formatting is part of the draft, not something rebuilt from its plain text. */
export function reviewTextChanged(base: ReviewTextValue, draft: ReviewTextValue): boolean {
  return base.text !== draft.text || base.html !== draft.html;
}
