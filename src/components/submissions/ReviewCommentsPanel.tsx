import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";

import { CommentItem } from "@/components/submissions/CommentCard";
import CommentThread from "@/components/submissions/CommentThread";
import PanelComposer from "@/components/submissions/PanelComposer";
import { commentBoxId, regionNumbers } from "@/components/submissions/commentParts";
import { useCommentReply, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewComment } from "@/types/submission";

// What other pages import from here.
export { COMMENT_CATEGORIES, commentBoxId, formatSec, regionNumbers } from "@/components/submissions/commentParts";
export { ReplyingTo } from "@/components/submissions/CommentCard";

/** A comment and every reply that follows its chain, oldest first. A reply whose comment was deleted starts its own thread. */
function groupThreads(comments: ReviewComment[]) {
  const byId = new Map(comments.map((c) => [c.id, c] as const));
  const rootOf = (c: ReviewComment): ReviewComment => {
    let cur = c;
    for (let i = 0; i < 50 && cur.reply_to_id && byId.has(cur.reply_to_id); i++) cur = byId.get(cur.reply_to_id)!;
    return cur;
  };
  const roots: ReviewComment[] = [];
  const replies = new Map<string, ReviewComment[]>();
  for (const c of comments) {
    const root = rootOf(c);
    if (root.id === c.id) roots.push(c);
    else replies.set(root.id, [...(replies.get(root.id) ?? []), c]);
  }
  return { roots, replies, rootOf };
}

/**
 * Saved review comments: what the reviewer wants changed and the creator's replies, kept per version.
 * The creator marks them resolved as they fix things.
 */
export default function ReviewCommentsPanel({
  submissionId,
  canComment,
  currentTime,
  onSeek,
  activeCommentId,
  onShowRegion,
  placeholder = "Add a comment...",
  emptyText = "No comments yet.",
  showHeader = true,
  showComposer = true,
}: {
  submissionId: string;
  /** Hide the box for writing a comment, when the page has its own (the Content screener's, under the video). */
  showComposer?: boolean;
  /** Hide the "Review comments" heading when the page already titles the section. */
  showHeader?: boolean;
  /** Reviewers and the creator. */
  canComment: boolean;
  /** When set (video playing), a comment can be pinned to this moment. */
  currentTime?: number;
  onSeek?: (sec: number) => void;
  /** The comment picked on the image, highlighted here. */
  activeCommentId?: string | null;
  /** Pick a comment (clicking its card): it is highlighted, and its area shown on the image. */
  onShowRegion?: (c: ReviewComment) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const { comments, isLoading, resolve, remove } = useReviewComments(submissionId);
  const { user: viewer } = useAuth();
  const { setReplyTo } = useCommentReply(submissionId);
  const open = useMemo(() => comments.filter((c) => !c.resolved_at).length, [comments]);
  const numbers = useMemo(() => regionNumbers(comments), [comments]);
  const threads = useMemo(() => groupThreads(comments), [comments]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  // Long threads show their latest replies; the rest open on request (or when one is jumped to).
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());

  // A box picked on the image brings its comment into view.
  useEffect(() => {
    if (activeCommentId) document.getElementById(`comment-${activeCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeCommentId]);

  /** Scroll to a comment (from a reply's quote) and ring it for a moment. */
  const jumpTo = (id: string) => {
    const target = comments.find((c) => c.id === id);
    if (target) {
      const root = threads.rootOf(target).id;
      setOpenThreads((prev) => (prev.has(root) ? prev : new Set(prev).add(root)));
    }
    window.setTimeout(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1800);
  };
  /** Reply: quote the comment in the comment box and put the cursor there (the page's own box, if it has one). */
  const replyToComment = (c: ReviewComment) => {
    setReplyTo(c);
    window.setTimeout(() => {
      const box = document.getElementById(commentBoxId(submissionId));
      box?.scrollIntoView({ behavior: "smooth", block: "center" });
      box?.focus();
    }, 50);
  };
  const setOpen = (root: string, on: boolean) =>
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (on) next.add(root);
      else next.delete(root);
      return next;
    });

  const item = (root: ReviewComment) => (c: ReviewComment) => (
    <CommentItem
      key={c.id}
      c={c}
      number={numbers.get(c.id)}
      active={c.id === activeCommentId}
      canResolve={canComment}
      highlighted={flashId === c.id}
      onSeek={onSeek}
      onShowRegion={onShowRegion}
      onResolve={(resolved) => resolve.mutate({ id: c.id, resolved })}
      onDelete={() => remove.mutate(c.id)}
      onReply={canComment ? () => replyToComment(c) : undefined}
      onJump={jumpTo}
      parentNumber={c.reply_to_id ? numbers.get(c.reply_to_id) : undefined}
      mineParent={Boolean(c.reply_to_id && viewer && comments.find((x) => x.id === c.reply_to_id)?.author_id === viewer.id)}
      hideQuote={c.reply_to_id === root.id}
    />
  );

  return (
    <div className="space-y-3">
      <div className={showHeader ? "flex items-center justify-between" : "hidden"}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MessageSquare className="w-3.5 h-3.5" /> Review comments
        </p>
        <span className="text-[11px] text-muted-foreground">{comments.length ? `${open} open · ${comments.length - open} resolved` : ""}</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
        </p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {threads.roots.map((root) => (
            <CommentThread
              key={root.id}
              root={root}
              replies={threads.replies.get(root.id) ?? []}
              expanded={openThreads.has(root.id)}
              onExpand={() => setOpen(root.id, true)}
              onCollapse={() => setOpen(root.id, false)}
              renderItem={item(root)}
            />
          ))}
        </div>
      )}

      {canComment && showComposer && <PanelComposer submissionId={submissionId} currentTime={currentTime} placeholder={placeholder} />}
    </div>
  );
}
