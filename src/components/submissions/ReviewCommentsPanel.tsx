import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock, Loader2, MessageSquare, Reply, RotateCcw, ScanSearch, Send, ShieldCheck, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommentReply, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewComment, ReviewCommentCategory } from "@/types/submission";

export const COMMENT_CATEGORIES: { value: ReviewCommentCategory; label: string; tone: string }[] = [
  { value: "LEGAL", label: "Legal", tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  { value: "EDITORIAL", label: "Editorial", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "COMPLIANCE", label: "Compliance", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { value: "BRAND", label: "Brand", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { value: "NOTE", label: "Note", tone: "bg-muted text-muted-foreground" },
];
const toneFor = (c: string) => COMMENT_CATEGORIES.find((x) => x.value === c)?.tone ?? "bg-muted text-muted-foreground";
const labelFor = (c: string) => COMMENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** The numbers shown on image boxes and beside their comments, in the order the comments were written. */
export const regionNumbers = (comments: ReviewComment[]): Map<string, number> =>
  new Map(comments.filter((c) => c.file_id && c.region_w != null).map((c, i) => [c.id, i + 1] as const));

export const formatSec = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** The id of a post's comment box, so a Reply can put the cursor in it wherever the page shows it. */
export const commentBoxId = (submissionId: string) => `comment-box-${submissionId}`;

/** Above a comment box while replying: who and what is being replied to, with a way to stop replying. */
export function ReplyingTo({ c, onCancel }: { c: ReviewComment; onCancel: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border-l-4 border-primary bg-primary/5 px-2.5 py-1.5 text-[11px]">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary">Replying to {c.author_name ?? "a comment"}</p>
        <p className="truncate text-muted-foreground">{c.body}</p>
      </div>
      <button type="button" onClick={onCancel} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Stop replying">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CommentItem({
  c,
  number,
  active,
  canResolve,
  highlighted,
  onSeek,
  onShowRegion,
  onResolve,
  onDelete,
  onReply,
  onJump,
}: {
  c: ReviewComment;
  /** Its number on the image, when it is about an area of one. */
  number?: number;
  active?: boolean;
  canResolve: boolean;
  /** Just jumped to from a reply's quote: briefly ringed so it's easy to spot. */
  highlighted: boolean;
  onSeek?: (sec: number) => void;
  onShowRegion?: (c: ReviewComment) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
  /** Reply to this comment (only for people who can comment). */
  onReply?: () => void;
  /** Go to the comment this one replies to. */
  onJump: (id: string) => void;
}) {
  const resolved = Boolean(c.resolved_at);
  // Clicking the card picks it (and shows its area on the image); its own buttons keep their jobs.
  const pick = onShowRegion
    ? (e: React.MouseEvent | React.KeyboardEvent) => {
        if ((e.target as HTMLElement).closest("button, a, input, textarea")) return;
        onShowRegion(c);
      }
    : undefined;
  return (
    <div
      id={`comment-${c.id}`}
      onClick={pick}
      onKeyDown={pick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(e)) : undefined}
      tabIndex={pick ? 0 : undefined}
      aria-pressed={pick ? Boolean(active) : undefined}
      className={`scroll-mt-4 rounded-lg border p-2.5 text-xs space-y-1.5 transition-colors duration-300 ${
        pick ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-blue-400/70" : ""
      } ${highlighted ? "ring-2 ring-primary ring-offset-1" : ""} ${
        active ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500 shadow-sm" : resolved ? "border-border/60 opacity-70" : c.from_reviewer ? "border-amber-500/30 bg-amber-500/5" : "border-border/80"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-foreground">{c.author_name ?? "Someone"}</span>
        {c.from_reviewer && (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-px text-[10px] font-semibold text-blue-700 dark:text-blue-300">
            <ShieldCheck className="w-3 h-3" /> Reviewer
          </span>
        )}
        <span className={`rounded px-1 py-px text-[10px] font-semibold ${toneFor(c.category)}`}>{labelFor(c.category)}</span>
        {number != null && (
          <button
            type="button"
            disabled={!onShowRegion}
            onClick={() => onShowRegion?.(c)}
            className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] font-semibold text-primary disabled:text-muted-foreground"
            title={onShowRegion ? "Show this area on the image" : undefined}
          >
            <ScanSearch className="w-3 h-3" /> Image area {number}
          </button>
        )}
        {c.start_sec != null && (
          <button
            type="button"
            disabled={!onSeek}
            onClick={() => onSeek?.(c.start_sec!)}
            className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] font-semibold text-primary disabled:text-muted-foreground"
            title={onSeek ? "Jump to this moment" : undefined}
          >
            <Clock className="w-3 h-3" /> {formatSec(c.start_sec)}
            {c.end_sec != null && c.end_sec > c.start_sec && `–${formatSec(c.end_sec)}`}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {c.version_number > 0 ? `v${c.version_number}` : "draft"} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
        </span>
      </div>
      {c.reply_to_id && (
        // The comment this replies to, as in a chat app; a click goes to it.
        <button
          type="button"
          onClick={() => c.reply_to_body != null && onJump(c.reply_to_id!)}
          disabled={c.reply_to_body == null}
          className="block w-full rounded-md border-l-4 border-primary/60 bg-muted/60 px-2 py-1 text-left hover:bg-muted disabled:cursor-default"
          title={c.reply_to_body != null ? "Go to this message" : undefined}
        >
          <span className="block text-[10px] font-semibold text-primary">{c.reply_to_author ?? "Someone"}</span>
          <span className="line-clamp-2 text-[11px] text-muted-foreground">{c.reply_to_body ?? "This message was deleted."}</span>
        </button>
      )}
      <p className={`whitespace-pre-wrap break-words text-foreground ${resolved ? "line-through decoration-muted-foreground/50" : ""}`}>{c.body}</p>
      <div className="flex items-center gap-2 text-[10px]">
        {resolved ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <Check className="w-3 h-3" /> Resolved{c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
          </span>
        ) : null}
        <span className="flex-1" />
        {onReply && (
          <button type="button" onClick={onReply} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
            <Reply className="w-3 h-3" /> Reply
          </button>
        )}
        {canResolve && (
          <button type="button" onClick={() => onResolve(!resolved)} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground">
            {resolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />} {resolved ? "Reopen" : "Mark resolved"}
          </button>
        )}
        {c.can_delete && (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-red-600" aria-label="Delete comment">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
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
  const { comments, isLoading, add, resolve, remove } = useReviewComments(submissionId);
  // Reviewers file feedback under a category (legal, editorial...). Creators just leave the reviewer a note.
  const { hasPermission } = useAuth();
  const asReviewer = hasPermission("CONTENT_REVIEW_VIEW");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");
  const [pin, setPin] = useState(false);
  const open = useMemo(() => comments.filter((c) => !c.resolved_at).length, [comments]);
  const numbers = useMemo(() => regionNumbers(comments), [comments]);
  // A box picked on the image brings its comment into view.
  useEffect(() => {
    if (activeCommentId) document.getElementById(`comment-${activeCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeCommentId]);
  const { replyTo, setReplyTo } = useCommentReply(submissionId);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  /** Scroll to a comment (from a reply's quote) and ring it for a moment. */
  const jumpTo = (id: string) => {
    document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    <div className="space-y-3">
      <div className={showHeader ? "flex items-center justify-between" : "hidden"}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <MessageSquare className="w-3.5 h-3.5" /> Review comments
        </p>
        <span className="text-[11px] text-muted-foreground">
          {comments.length ? `${open} open · ${comments.length - open} resolved` : ""}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
        </p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
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
            />
          ))}
        </div>
      )}

      {canComment && showComposer && (
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
            {asReviewer && COMMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                aria-pressed={category === cat.value}
                onClick={() => setCategory(cat.value)}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  category === cat.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
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
      )}
    </div>
  );
}
