import { useCallback, useState } from "react";
import { findingImageIndex } from "@/lib/findingImage";
import { useReviewComments } from "@/hooks/useReview";
import type { ReviewQueueItem } from "@/types/submission";
import type { ComplianceViolation } from "@/services/complianceService";

/** Rule selection also navigates the carousel, including repeated clicks on the same rule. */
export function useScreenerMediaNavigation(submission: ReviewQueueItem) {
  const [picked, setPickedRule] = useState<string | null>(null);
  const [pickedFinding, setPickedFinding] = useState<ComplianceViolation | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [activeComment, setActiveCommentId] = useState<string | null>(null);
  const { comments } = useReviewComments(submission.id);
  const setActiveComment = useCallback((id: string | null) => {
    setActiveCommentId(id);
    const fileId = comments.find((comment) => comment.id === id)?.file_id;
    const index = fileId ? (submission.images ?? []).findIndex((image) => image.id === fileId) : -1;
    if (index >= 0) setImageIndex(index);
  }, [comments, submission.images]);
  const setPicked = (ruleId: string | null, finding?: ComplianceViolation) => {
    setPickedRule(ruleId);
    setPickedFinding(finding ?? null);
    if (!ruleId) return;
    const index = findingImageIndex(submission.images ?? [], finding ? [finding] : submission.latest_check?.violations ?? [], ruleId, imageIndex, submission.latest_check?.violations);
    if (index >= 0) setImageIndex(index);
  };
  return { picked, pickedFinding, setPicked, imageIndex, setImageIndex, activeComment, setActiveComment };
}
