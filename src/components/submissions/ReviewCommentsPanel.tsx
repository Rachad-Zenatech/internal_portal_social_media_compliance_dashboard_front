import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock, Loader2, MessageSquare, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewComments } from "@/hooks/useReview";
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

export const formatSec = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function CommentItem({
  c,
  canResolve,
  onSeek,
  onResolve,
  onDelete,
}: {
  c: ReviewComment;
  canResolve: boolean;
  onSeek?: (sec: number) => void;
  onResolve: (resolved: boolean) => void;
  onDelete: () => void;
}) {
  const resolved = Boolean(c.resolved_at);
  return (
    <div className={`rounded-lg border p-2.5 text-xs space-y-1.5 ${resolved ? "border-border/60 opacity-70" : c.from_reviewer ? "border-amber-500/30 bg-amber-500/5" : "border-border/80"}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-foreground">{c.author_name ?? "Someone"}</span>
        {c.from_reviewer && (
          <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1 py-px text-[10px] font-semibold text-blue-700 dark:text-blue-300">
            <ShieldCheck className="w-3 h-3" /> Reviewer
          </span>
        )}
        <span className={`rounded px-1 py-px text-[10px] font-semibold ${toneFor(c.category)}`}>{labelFor(c.category)}</span>
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
      <p className={`whitespace-pre-wrap break-words text-foreground ${resolved ? "line-through decoration-muted-foreground/50" : ""}`}>{c.body}</p>
      <div className="flex items-center gap-2 text-[10px]">
        {resolved ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <Check className="w-3 h-3" /> Resolved{c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
          </span>
        ) : null}
        <span className="flex-1" />
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
  placeholder = "Add a comment...",
  emptyText = "No comments yet.",
  showHeader = true,
}: {
  submissionId: string;
  /** Hide the "Review comments" heading when the page already titles the section. */
  showHeader?: boolean;
  /** Reviewers and the creator. */
  canComment: boolean;
  /** When set (video playing), a comment can be pinned to this moment. */
  currentTime?: number;
  onSeek?: (sec: number) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const { comments, isLoading, add, resolve, remove } = useReviewComments(submissionId);
  // Reviewers file feedback under a category (legal, editorial...). Creators just leave the reviewer a note.
  const { hasPermission } = useAuth();
  const asReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");
  const [pin, setPin] = useState(false);
  const open = useMemo(() => comments.filter((c) => !c.resolved_at).length, [comments]);

  const submit = () => {
    if (!body.trim()) return;
    add.mutate(
      { body: body.trim(), category: asReviewer ? category : "NOTE", start_sec: pin && currentTime != null ? Math.round(currentTime * 10) / 10 : null },
      { onSuccess: () => setBody("") }
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
              canResolve={canComment}
              onSeek={onSeek}
              onResolve={(resolved) => resolve.mutate({ id: c.id, resolved })}
              onDelete={() => remove.mutate(c.id)}
            />
          ))}
        </div>
      )}

      {canComment && (
        <div className="space-y-2 rounded-lg border border-border/80 p-2.5">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={asReviewer ? placeholder : "Anything the reviewer should know? e.g. the figures are from the Oct 13 press release"}
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
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
