import SourceChecks from "@/components/submissions/SourceChecks";
import ReviewerComplianceRecheck from "./ReviewerComplianceRecheck";
import type { ReviewQueueItem } from "@/types/reviewQueue";

/** Source comparisons and the manual text-post retry belong to the compliance tab. */
export default function ReviewerComplianceSources({ post, canReview, onViewChange }: {
  post: ReviewQueueItem;
  canReview: boolean;
  onViewChange: (view: "checks" | "review") => void;
}) {
  return (
    <>
      {post.content_type === "TEXT_POST" && <ReviewerComplianceRecheck key={post.id} submissionId={post.id} canRun={canReview && post.status === "IN_REVIEW"} />}
      <SourceChecks checks={post.latest_check?.source_checks} submissionId={post.id} onViewChange={onViewChange} />
    </>
  );
}
