import type { ReactNode } from "react";
import { Reply } from "lucide-react";

import type { ReviewComment } from "@/types/submission";

/** A thread longer than this shows only its latest replies until it is opened. */
const COLLAPSE_AFTER = 3;
const SHOWN_REPLIES = 2;

/** A comment and the replies that follow it, indented under it with a line down the side; long threads fold up. */
export default function CommentThread({
  root,
  replies,
  expanded,
  onExpand,
  onCollapse,
  renderItem,
}: {
  root: ReviewComment;
  replies: ReviewComment[];
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  renderItem: (c: ReviewComment) => ReactNode;
}) {
  const long = replies.length > COLLAPSE_AFTER;
  const hidden = long && !expanded ? replies.length - SHOWN_REPLIES : 0;
  const shown = hidden ? replies.slice(-SHOWN_REPLIES) : replies;
  return (
    <div className="space-y-1.5">
      {renderItem(root)}
      {replies.length > 0 && (
        <div className="ml-3.5 space-y-1.5 border-l-2 border-border pl-3">
          {hidden > 0 && (
            <button type="button" onClick={onExpand} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
              <Reply className="w-3 h-3" /> Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
            </button>
          )}
          {shown.map(renderItem)}
          {long && expanded && (
            <button type="button" onClick={onCollapse} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              Show fewer replies
            </button>
          )}
        </div>
      )}
    </div>
  );
}
