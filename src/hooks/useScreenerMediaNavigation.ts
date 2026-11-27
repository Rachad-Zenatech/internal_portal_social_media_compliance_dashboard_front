import { findingEvidence } from "@/lib/findingEvidence";
import { useCallback, useState } from "react";
import { findingImageIndex } from "@/lib/findingImage";
import { useReviewComments } from "@/hooks/useReview";
import type { ReviewQueueItem } from "@/types/submission";
import type { ComplianceViolation } from "@/services/complianceService";

/** Selecting a finding navigates its image; selecting it again clears the highlight. */
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
    const sameFinding = finding === pickedFinding || Boolean(finding && pickedFinding &&
      JSON.stringify([findingEvidence(finding), finding.image_file_ids]) === JSON.stringify([findingEvidence(pickedFinding), pickedFinding.image_file_ids]));
    const nextRule = ruleId === picked && (!finding || sameFinding) ? null : ruleId;
    setPickedRule(nextRule);
    setPickedFinding(nextRule ? finding ?? null : null);
    if (!nextRule) return;
    const index = findingImageIndex(submission.images ?? [], finding ? [finding] : submission.latest_check?.violations ?? [], nextRule, imageIndex, submission.latest_check?.violations);
    if (index >= 0) setImageIndex(index);
  };
  return { picked, pickedFinding, setPicked, imageIndex, setImageIndex, activeComment, setActiveComment };
}
