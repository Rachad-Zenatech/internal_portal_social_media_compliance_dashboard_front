import type { KeyboardEvent, MouseEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock, Reply, RotateCcw, ScanSearch, ShieldCheck, Trash2 } from "lucide-react";

import type { ReviewComment } from "@/types/submission";

import { formatSec, labelFor, toneFor } from "./reviewComments";

/** A small tag for a comment on an area of an image, in the quotes and the reply strip as on the card itself. */
export function AreaTag({ number }: { number: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-background/70 px-1 py-px text-[10px] font-semibold text-primary">
      <ScanSearch className="w-3 h-3" /> Image area {number}
    </span>
  );
}

export interface CommentItemProps {
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
}

const CHIP = "inline-flex items-center gap-0.5 rounded bg-muted px-1 py-px text-[10px] font-semibold text-primary disabled:text-muted-foreground";
const ACTION = "inline-flex items-center gap-1 font-semibold text-muted-foreground";

function cardClass(pickable: boolean, highlighted: boolean, active: boolean | undefined, resolved: boolean) {
  const pick = pickable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-blue-400/70" : "";
  const ring = highlighted ? "ring-2 ring-primary ring-offset-1" : "";
  const state = active
    ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500 shadow-sm"
    : resolved
    ? "border-border/60 bg-card opacity-70"
    : "border-border/80 bg-card";
  return `scroll-mt-4 rounded-lg border p-2.5 text-xs space-y-1.5 transition-colors duration-300 ${pick} ${ring} ${state}`;
}

/** One comment: who wrote it, what it's on, the comment it answers, its text, and Reply / Resolve / Delete. */
export default function CommentItem(props: CommentItemProps) {
  const { c, active, highlighted, onShowRegion, hideQuote } = props;
  const resolved = Boolean(c.resolved_at);
  // Clicking the card picks it (and shows its area on the image); its own buttons keep their jobs.
  const pick = onShowRegion
    ? (e: MouseEvent | KeyboardEvent) => {
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
      className={cardClass(Boolean(pick), highlighted, active, resolved)}
    >
      <CommentHeader {...props} />
      {c.reply_to_id && !hideQuote && <ReplyQuote {...props} />}
      <p className={`whitespace-pre-wrap break-words text-foreground ${resolved ? "line-through decoration-muted-foreground/50" : ""}`}>{c.body}</p>
      <CommentFooter {...props} resolved={resolved} />
    </div>
  );
}

function CommentHeader({ c, number, onShowRegion, onSeek }: CommentItemProps) {
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
        <button type="button" disabled={!onShowRegion} onClick={() => onShowRegion?.(c)} className={CHIP} title={onShowRegion ? "Show this area on the image" : undefined}>
          <ScanSearch className="w-3 h-3" /> Image area {number}
        </button>
      )}
      {c.start_sec != null && (
        <button type="button" disabled={!onSeek} onClick={() => onSeek?.(c.start_sec!)} className={CHIP} title={onSeek ? "Jump to this moment" : undefined}>
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

/** The comment this replies to, as in a chat app; a click goes to it. */
function ReplyQuote({ c, mineParent, parentNumber, onJump }: CommentItemProps) {
  const gone = c.reply_to_body == null;
  return (
    <button
      type="button"
      onClick={() => !gone && onJump(c.reply_to_id!)}
      disabled={gone}
      className="block w-full rounded-md border-l-4 border-primary/60 bg-muted/60 px-2 py-1 text-left hover:bg-muted disabled:cursor-default"
      title={gone ? undefined : "Go to this message"}
    >
      <span className="block text-[10px] font-semibold text-primary">
        {mineParent ? "You" : c.reply_to_author ?? "Someone"}
        {parentNumber != null && <AreaTag number={parentNumber} />}
      </span>
      <span className="line-clamp-2 text-[11px] text-muted-foreground">{c.reply_to_body ?? "This message was deleted."}</span>
    </button>
  );
}

function CommentFooter({ c, resolved, canResolve, onReply, onResolve, onDelete }: CommentItemProps & { resolved: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {resolved && (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
          <Check className="w-3 h-3" /> Resolved{c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
        </span>
      )}
      <span className="flex-1" />
      {onReply && (
        <button type="button" onClick={onReply} className={`${ACTION} hover:text-foreground`}>
          <Reply className="w-3 h-3" /> Reply
        </button>
      )}
      {canResolve && (
        <button type="button" onClick={() => onResolve(!resolved)} className={`${ACTION} hover:text-foreground`}>
          {resolved ? <RotateCcw className="w-3 h-3" /> : <Check className="w-3 h-3" />} {resolved ? "Reopen" : "Mark resolved"}
        </button>
      )}
      {c.can_delete && (
        <button type="button" onClick={onDelete} className={`${ACTION} hover:text-red-600`} aria-label="Delete comment">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
