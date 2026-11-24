export interface PostApprovalSuggestionFields {
  suggestions_until?: string | null;
  can_suggest_after_approval?: boolean;
}

export interface PublishingAccess {
  can_publish: boolean;
  suggestions_until?: string | null;
  message?: string | null;
}
