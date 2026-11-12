import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import { COMMENT_CATEGORIES, commentBoxId, formatSec } from "@/components/submissions/commentParts";
import { ReplyingTo } from "@/components/submissions/CommentCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommentReply, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewCommentCategory } from "@/types/submission";

/** The comment box under the comments: write a note, file it under a category (reviewers), pin it to a moment, reply. */
export default function PanelComposer({ submissionId, currentTime, placeholder }: { submissionId: string; currentTime?: number; placeholder: string }) {
  const { add } = useReviewComments(submissionId);
  const { replyTo, setReplyTo } = useCommentReply(submissionId);
  // Reviewers file feedback under a category (legal, editorial...). Creators just leave the reviewer a note.
  const { hasPermission } = useAuth();
  const asReviewer = hasPermission("CONTENT_REVIEW_VIEW");
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
        {asReviewer &&
          COMMENT_CATEGORIES.map((cat) => (
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
  );
}
