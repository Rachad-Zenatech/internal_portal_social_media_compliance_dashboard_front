import type { PostApprovalSuggestionFields } from "@/types/postApprovalSuggestions";

export type SuggestionPost = PostApprovalSuggestionFields & { status?: string; can_manage_approval?: boolean };

export function postSuggestionState(post: SuggestionPost | null | undefined, now = Date.now()) {
  const approved = post?.status === "APPROVED";
  const pending = Boolean(post?.review_decision_pending);
  const deadline = (approved || pending) && post?.suggestions_until ? Date.parse(post.suggestions_until) : NaN;
  const remainingMs = Number.isFinite(deadline) ? Math.max(0, deadline - now) : 0;
  const open = (approved || pending) && remainingMs > 0;
  const canComment = Boolean(post && (pending ? open && post.can_suggest_after_approval
    : approved && (post.can_manage_approval || (open && post.can_suggest_after_approval))));
  return { approved, pending, deadline, remainingMs, open, canComment, publishingBlocked: open || pending };
}

export function suggestionTimeLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = seconds % 60;
  return (days ? days + "d " : "") + hours + "h " + minutes + "m " + rest + "s";
}
