import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Reply, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommentReply, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewComment, ReviewCommentCategory } from "@/types/submission";

import CommentItem, { AreaTag, type CommentItemProps } from "./ReviewCommentItem";
import { COMMENT_CATEGORIES, commentBoxId, formatSec, regionNumbers } from "./reviewComments";

// Kept here too so existing imports from this file keep working.
export { COMMENT_CATEGORIES, commentBoxId, formatSec, regionNumbers };

/** Above a comment box while replying: who and what is being replied to, with a way to stop replying. */
export function ReplyingTo({ c, onCancel }: { c: ReviewComment; onCancel: () => void }) {
  const { user } = useAuth();
  const { comments } = useReviewComments(c.submission_id);
  const number = regionNumbers(comments).get(c.id);
  const mine = Boolean(user && c.author_id === user.id);
  return (
    <div className="flex items-start gap-2 rounded-md border-l-4 border-primary bg-primary/5 px-2.5 py-1.5 text-[11px]">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary">
          Replying to {mine ? "yourself" : c.author_name ?? "a comment"}
          {number != null && <AreaTag number={number} />}
        </p>
        <p className="truncate text-muted-foreground">{c.body}</p>
      </div>
      <button type="button" onClick={onCancel} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Stop replying">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Long threads show their latest replies; the rest open on request (or when one is jumped to).
const SHOWN_REPLIES = 2;
const COLLAPSE_AFTER = 3;

/** Threads: a comment and every reply that follows its chain, oldest first. A reply whose comment was deleted starts its own. */
function useThreads(comments: ReviewComment[]) {
  return useMemo(() => {
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
  }, [comments]);
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
  const open = useMemo(() => comments.filter((c) => !c.resolved_at).length, [comments]);
  const numbers = useMemo(() => regionNumbers(comments), [comments]);
  // A box picked on the image brings its comment into view.
  useEffect(() => {
    if (activeCommentId) document.getElementById(`comment-${activeCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeCommentId]);
  const { setReplyTo } = useCommentReply(submissionId);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const threads = useThreads(comments);
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const setThreadOpen = (id: string, on: boolean) =>
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

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
  const itemProps = (c: ReviewComment, root: ReviewComment): CommentItemProps => ({
    c,
    number: numbers.get(c.id),
    active: c.id === activeCommentId,
    canResolve: canComment,
    highlighted: flashId === c.id,
    onSeek,
    onShowRegion,
    onResolve: (resolved) => resolve.mutate({ id: c.id, resolved }),
    onDelete: () => remove.mutate(c.id),
    onReply: canComment ? () => replyToComment(c) : undefined,
    onJump: jumpTo,
    parentNumber: c.reply_to_id ? numbers.get(c.reply_to_id) : undefined,
    mineParent: Boolean(c.reply_to_id && viewer && comments.find((x) => x.id === c.reply_to_id)?.author_id === viewer.id),
    hideQuote: c.reply_to_id === root.id,
  });

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
              onExpand={(on) => setThreadOpen(root.id, on)}
              itemProps={(c) => itemProps(c, root)}
            />
          ))}
        </div>
      )}
      {canComment && showComposer && (
        <CommentComposer submissionId={submissionId} currentTime={currentTime} placeholder={placeholder} />
      )}
    </div>
  );
}

/** A comment and its replies; a long thread shows its latest replies until it's opened. */
function CommentThread({
  root,
  replies,
  expanded,
  onExpand,
  itemProps,
}: {
  root: ReviewComment;
  replies: ReviewComment[];
  expanded: boolean;
  onExpand: (on: boolean) => void;
  itemProps: (c: ReviewComment) => CommentItemProps;
}) {
  const long = replies.length > COLLAPSE_AFTER;
  const collapsed = long && !expanded;
  const hidden = collapsed ? replies.length - SHOWN_REPLIES : 0;
  const shown = collapsed ? replies.slice(-SHOWN_REPLIES) : replies;
  return (
    <div className="space-y-1.5">
      <CommentItem {...itemProps(root)} />
      {replies.length > 0 && (
        <div className="ml-3.5 space-y-1.5 border-l-2 border-border pl-3">
          {hidden > 0 && (
            <button type="button" onClick={() => onExpand(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
              <Reply className="w-3 h-3" /> Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
            </button>
          )}
          {shown.map((c) => (
            <CommentItem key={c.id} {...itemProps(c)} />
          ))}
          {long && expanded && (
            <button type="button" onClick={() => onExpand(false)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              Show fewer replies
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The box for writing a comment (reviewers pick a category) or a note to the reviewer (creators). */
function CommentComposer({ submissionId, currentTime, placeholder }: { submissionId: string; currentTime?: number; placeholder: string }) {
  const { add } = useReviewComments(submissionId);
  // Reviewers file feedback under a category (legal, editorial...). Creators just leave the reviewer a note.
  const { hasPermission } = useAuth();
  const asReviewer = hasPermission("CONTENT_REVIEW_VIEW");
  const { replyTo, setReplyTo } = useCommentReply(submissionId);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");
  const [pin, setPin] = useState(false);

  const submit = () => {
    if (!body.trim()) return;
    add.mutate(
      {
        body: body.trim(),
        category: asReviewer ? category : "NOTE",
        start_sec: pin && currentTime != null ? Math.round(currentTime * 10) / 10 : null,
        reply_to_id: replyTo?.id ?? null,
      },
      {
        onSuccess: () => {
          setBody("");
          setReplyTo(null);
        },
      }
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/80 p-2.5">
      {replyTo && <ReplyingTo c={replyTo} onCancel={() => setReplyTo(null)} />}
      <Textarea
        id={commentBoxId(submissionId)}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={asReviewer ? placeholder : "Anything the reviewer should know? e.g. the figures are from the Oct 13 press release"}
        className="text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape" && replyTo) setReplyTo(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {asReviewer && <CategoryPicker value={category} onChange={setCategory} />}
        {currentTime != null && (
          <label className={`${asReviewer ? "ml-1" : ""} inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer`}>
            <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} className="accent-current" />
            Pin to {formatSec(currentTime)}
          </label>
        )}
        <span className="flex-1" />
        <Button size="sm" className="h-7 px-2.5 text-xs gap-1" disabled={!body.trim() || add.isPending} onClick={submit}>
          {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {asReviewer ? "Comment" : "Send note"}
        </Button>
      </div>
    </div>
  );
}

function CategoryPicker({ value, onChange }: { value: ReviewCommentCategory; onChange: (c: ReviewCommentCategory) => void }) {
  return (
    <>
      {COMMENT_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          aria-pressed={value === cat.value}
          onClick={() => onChange(cat.value)}
          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            value === cat.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </>
  );
}
