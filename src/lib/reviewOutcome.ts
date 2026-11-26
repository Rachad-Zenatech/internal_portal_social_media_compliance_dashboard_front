type ReviewOutcomePost = { status: string; publish_after_changes?: boolean };

/** Approval with creator edits is still approved; editing permission is a separate workflow concern. */
export function approvedForFinalEdits(post: ReviewOutcomePost) {
  return Boolean(post.publish_after_changes && ["IN_REVIEW", "CHANGES_REQUESTED"].includes(post.status));
}

export function reviewOutcomeStatus(post: ReviewOutcomePost) {
  return approvedForFinalEdits(post) ? "APPROVED" : post.status;
}
