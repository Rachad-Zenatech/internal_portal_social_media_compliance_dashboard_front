import type { PostApprovalSuggestionFields } from "@/types/postApprovalSuggestions";

export type SuggestionPost = PostApprovalSuggestionFields & { status?: string; approval_needed_by?: string | null; can_manage_approval?: boolean };

export function postSuggestionState(post: SuggestionPost | null | undefined, now = Date.now()) {
  const approved = post?.status === "APPROVED";
  const pending = Boolean(post?.review_decision_pending);
  const reviewing = post?.status === "IN_REVIEW" && !pending;
  const until = reviewing ? post.approval_needed_by ?? post.suggestions_until : post?.suggestions_until;
  const deadline = (approved || pending || reviewing) && until ? Date.parse(until) : NaN;
  const remainingMs = Number.isFinite(deadline) ? Math.max(0, deadline - now) : 0;
  const open = (approved || pending) && remainingMs > 0;
  const canComment = Boolean(post && (pending ? open && post.can_suggest_after_approval
    : approved && (post.can_manage_approval || (open && post.can_suggest_after_approval))));
  return { approved, pending, reviewing, deadline, remainingMs, overdueMs: reviewing ? Math.max(0, now - deadline) : 0, open, canComment, publishingBlocked: open || pending };
}

export function suggestionTimeLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = seconds % 60;
  return (days ? days + "d " : "") + hours + "h " + minutes + "m " + rest + "s";
}
