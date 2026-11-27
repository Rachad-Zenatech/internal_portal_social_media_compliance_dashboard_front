type ReviewOutcomePost = { status: string; publish_after_changes?: boolean; review_decision_pending?: boolean };

/** Approval with creator edits is still approved; editing permission is a separate workflow concern. */
export function approvedForFinalEdits(post: ReviewOutcomePost) {
  return Boolean(post.publish_after_changes && post.status === "CHANGES_REQUESTED" && !post.review_decision_pending);
}

export function reviewOutcomeStatus(post: ReviewOutcomePost) {
  return post.review_decision_pending ? "IN_REVIEW" : approvedForFinalEdits(post) ? "APPROVED" : post.status;
}
