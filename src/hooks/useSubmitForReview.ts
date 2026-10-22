import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { MISSING_LABELS } from "@/components/submissions/submissionUi";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { ApiError } from "@/services/helper";
import { submissionService } from "@/services/submissionService";

interface SubmitTarget {
  id: string;
  referenceCode: string;
  /** Videos show up in the Content Screener queue; other content goes to review only. */
  isVideo: boolean;
}

/** Quick "send for review" for a draft (or resubmit after changes), outside the New Submission form. */
export function useSubmitForReview() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveVideoId } = useVideoUploadQueue();

  return useMutation({
    mutationFn: (target: SubmitTarget) => submissionService.submit(target.id),
    onSuccess: (result, target) => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.removeQueries({ queryKey: ["submission", target.id] });
      queryClient.removeQueries({ queryKey: ["submission-history", target.id] });
      const score = `Automated check: ${result.review_job.score}/100.`;
      if (target.isVideo) {
        setActiveVideoId(`sub-${target.id}`);
        toast.success(`${target.referenceCode} sent for review. Reviewers have been notified. ${score}`, {
          action: { label: "Open screener", onClick: () => navigate("/compliance/scanner") },
        });
      } else {
        toast.success(`${target.referenceCode} submitted for review. ${score}`);
      }
    },
    onError: (err, target) => {
      if (err instanceof ApiError && err.status === 422 && err.detail && typeof err.detail === "object" && "missing" in err.detail) {
        const missing = (err.detail as { missing: string[] }).missing;
        toast.error(`${target.referenceCode} isn't ready yet. Add: ${missing.map((m) => MISSING_LABELS[m] || m).join(", ")}.`, {
          action: { label: "Finish draft", onClick: () => navigate(`/submissions/new?id=${target.id}`) },
        });
        return;
      }
      toast.error(`Couldn't submit ${target.referenceCode}: ${err instanceof Error ? err.message : "unknown error"}`);
    },
  });
}
