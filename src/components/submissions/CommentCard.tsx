import { formatDistanceToNow } from "date-fns";
import { Check, Clock, Reply, RotateCcw, ScanSearch, ShieldCheck, Trash2, X } from "lucide-react";

import { AreaTag, formatSec, labelFor, regionNumbers, toneFor } from "@/components/submissions/commentParts";
import { useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewComment } from "@/types/submission";

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

const chip = "inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] font-semibold text-primary disabled:text-muted-foreground";

/** Who wrote it and what kind it is, where it points (an image area or a video moment), and when. */
function CommentHeader({
  c,
  number,
  onSeek,
  onShowRegion,
}: {
  c: ReviewComment;
  number?: number;
  onSeek?: (sec: number) => void;
  onShowRegion?: (c: ReviewComment) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-foreground">{c.author_name ?? "Someone"}</span>
      {c.from_reviewer && (
        <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-px text-[10px] font-semibold text-blue-700 dark:text-blue-300">
          <ShieldCheck className="w-3 h-3" /> Reviewer
        </span>
      )}
      <span className={`rounded px-1 py-px text-[10px] font-semibold ${toneFor(c.category)}`}>{labelFor(c.category)}</span>
      {number != null && (
        <button type="button" disabled={!onShowRegion} onClick={() => onShowRegion?.(c)} className={chip} title={onShowRegion ? "Show this area on the image" : undefined}>
          <ScanSearch className="w-3 h-3" /> Image area {number}
        </button>
      )}
      {c.start_sec != null && (
        <button type="button" disabled={!onSeek} onClick={() => onSeek?.(c.start_sec!)} className={chip} title={onSeek ? "Jump to this moment" : undefined}>
          <Clock className="w-3 h-3" /> {formatSec(c.start_sec)}
          {c.end_sec != null && c.end_sec > c.start_sec && `–${formatSec(c.end_sec)}`}
        </button>
      )}
      <span className="text-[10px] text-muted-foreground ml-auto">
        {c.version_number > 0 ? `v${c.version_number}` : "draft"} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
      </span>
    </div>
  );
}

/** The comment this one replies to, as in a chat app; a click goes to it. */
function ReplyQuote({ c, mineParent, parentNumber, onJump }: { c: ReviewComment; mineParent?: boolean; parentNumber?: number; onJump: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => c.reply_to_body != null && onJump(c.reply_to_id!)}
      disabled={c.reply_to_body == null}
      className="block w-full rounded-md border-l-4 border-primary/60 bg-muted/60 px-2 py-1 text-left hover:bg-muted disabled:cursor-default"
      title={c.reply_to_body != null ? "Go to this message" : undefined}
    >
      <span className="block text-[10px] font-semibold text-primary">
        {mineParent ? "You" : c.reply_to_author ?? "Someone"}
        {parentNumber != null && <AreaTag number={parentNumber} />}
      </span>
      <span className="line-clamp-2 text-[11px] text-muted-foreground">{c.reply_to_body ?? "This message was deleted."}</span>
    </button>
  );
}

const action = "inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground";

/** Resolved by whom, and the buttons: reply, mark resolved or reopen, delete. */
function CommentFooter({
  c,
  canResolve,
  onReply,
  onResolve,
  onDelete,
}: {
  c: ReviewComment;
  canResolve: boolean;
  onReply?: () => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
}) {
  const resolved = Boolean(c.resolved_at);
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {resolved && (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
          <Check className="w-3 h-3" /> Resolved{c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
        </span>
      )}
      <span className="flex-1" />
      {onReply && (
        <button type="button" onClick={onReply} className={action}>
          <Reply className="w-3 h-3" /> Reply
        </button>
      )}
      {canResolve && (
        <button type="button" onClick={() => onResolve(!resolved)} className={action}>
          {resolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />} {resolved ? "Reopen" : "Mark resolved"}
        </button>
      )}
      {c.can_delete && (
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-red-600" aria-label="Delete comment">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function CommentItem({
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
  parentNumber,
  mineParent,
  hideQuote,
}: {
  c: ReviewComment;
  /** Shown right under the comment it answers: no need to quote it again. */
  hideQuote?: boolean;
  /** The number of the image area the replied-to comment is on, if it is on one. */
  parentNumber?: number;
  /** The comment it replies to is the viewer's own. */
  mineParent?: boolean;
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
        active ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500 shadow-sm" : resolved ? "border-border/60 bg-card opacity-70" : "border-border/80 bg-card"
      }`}
    >
      <CommentHeader c={c} number={number} onSeek={onSeek} onShowRegion={onShowRegion} />
      {c.reply_to_id && !hideQuote && <ReplyQuote c={c} mineParent={mineParent} parentNumber={parentNumber} onJump={onJump} />}
      <p className={`whitespace-pre-wrap break-words text-foreground ${resolved ? "line-through decoration-muted-foreground/50" : ""}`}>{c.body}</p>
      <CommentFooter c={c} canResolve={canResolve} onReply={onReply} onResolve={onResolve} onDelete={onDelete} />
    </div>
  );
}
