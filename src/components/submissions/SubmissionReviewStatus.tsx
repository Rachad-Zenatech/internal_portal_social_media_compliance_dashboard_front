import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PostApprovalSuggestionNotice from "./PostApprovalSuggestionNotice";
import { useApprovedPostAccess } from "@/hooks/usePostApprovalSuggestions";

/** Keep the suggestion countdown on the creator's current post page. */
export default function SubmissionReviewStatus({ readOnly, submissionId, status }: {
  readOnly: boolean; submissionId: string | null; status: string;
}) {
  const access = useApprovedPostAccess(readOnly ? submissionId : undefined);
  if (!readOnly) return null;
  const heading = access.pending ? (access.open ? "Decision recorded: suggestions are still open" : "Decision recorded: finalizing review")
    : status === "APPROVED" ? "Approved: this post is locked" : "In review: this post is locked";
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 dark:border-blue-500/30 dark:bg-blue-500/10">
        <div className="min-w-0"><p className="text-sm font-semibold text-blue-950 dark:text-blue-100">{heading}</p><p className="text-[13px] text-blue-950/80 dark:text-blue-100/80">You can read the post and its results while it remains with reviewers.</p></div>
        <Button asChild type="button" variant="outline" size="sm" className="h-8 bg-card text-xs"><Link to="/submissions">My posts</Link></Button>
      </div>
      <PostApprovalSuggestionNotice access={access} />
    </section>
  );
}
