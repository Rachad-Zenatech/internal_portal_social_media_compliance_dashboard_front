import { useEffect } from "react";
import { useReviewComments } from "@/hooks/useReview";
import { captionNoteExcerpt, highlightCaptionNote } from "@/lib/captionNote";
import type { ReviewComment } from "@/types/submission";

/** Keep caption highlights tied to comment selection, including outside-click and unmount cleanup. */
export function useCaptionCommentSelection(submissionId: string, activeId: string | null, setActive: (id: string | null) => void) {
  const { comments } = useReviewComments(submissionId);
  const body = comments.find((comment) => comment.id === activeId)?.body;
  useEffect(() => {
    if (!activeId || !body) return;
    const clear = highlightCaptionNote(submissionId, body);
    if (!clear) return;
    const outside = (event: PointerEvent) => {
      const card = document.getElementById(`comment-${activeId}`);
      if (!(event.target instanceof Node) || !card?.contains(event.target)) setActive(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      clear();
    };
  }, [submissionId, activeId, body, setActive]);
  const selectComment = (comment: ReviewComment) => {
    setActive(captionNoteExcerpt(comment.body) ? comment.id : activeId === comment.id ? null : comment.id);
  };
  return { comments, selectComment };
}
