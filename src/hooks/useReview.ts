import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { ReviewCommentCreate, ReviewDecisionRequest } from "@/types/submission";

/** Everything that shows a submission's status or review state. */
function invalidateSubmission(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ["submission", id] });
  queryClient.invalidateQueries({ queryKey: ["submission-history", id] });
  queryClient.invalidateQueries({ queryKey: ["submissions"] });
  queryClient.invalidateQueries({ queryKey: ["review-queue"] });
}

/** Saved review comments for a submission, with add / resolve / delete. */
export function useReviewComments(submissionId?: string | null) {
  const queryClient = useQueryClient();
  const key = ["review-comments", submissionId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => submissionService.comments(submissionId!),
    enabled: Boolean(submissionId),
    staleTime: 0,
    // Reviewer and creator may be looking at the same item; keep comments reasonably fresh.
    refetchInterval: 30_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: (data: ReviewCommentCreate) => submissionService.addComment(submissionId!, data),
    onSuccess: refresh,
    onError: (err) => toast.error(`Couldn't save the comment: ${(err as Error).message}`),
  });
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => submissionService.resolveComment(submissionId!, id, resolved),
    onSuccess: refresh,
    onError: (err) => toast.error(`Couldn't update the comment: ${(err as Error).message}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => submissionService.deleteComment(submissionId!, id),
    onSuccess: refresh,
    onError: (err) => toast.error(`Couldn't delete the comment: ${(err as Error).message}`),
  });

  return { comments: query.data ?? [], isLoading: query.isLoading, add, resolve, remove };
}

/** A reviewer's decision: approve (schedule or publish now) or request changes. */
export function useReviewDecision(submissionId: string, referenceCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReviewDecisionRequest) => submissionService.review(submissionId, data),
    onSuccess: (_, data) => {
      invalidateSubmission(queryClient, submissionId);
      if (data.decision === "REQUEST_CHANGES") toast.success(`${referenceCode} sent back with your comments. The creator has been notified.`);
      else if (data.publish_now) toast.success(`${referenceCode} approved. Opening the publish page...`);
      else toast.success(`${referenceCode} approved and added to the content calendar.`);
    },
    onError: (err) => toast.error(`Couldn't save your decision: ${(err as Error).message}`),
  });
}

/** Approved content: the creator withdraws it for a late fix; a reviewer reschedules it or reopens it. */
export function useApprovalActions(submissionId: string, referenceCode: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateSubmission(queryClient, submissionId);
  const withdraw = useMutation({
    mutationFn: () => submissionService.withdraw(submissionId),
    onSuccess: () => {
      onSuccess();
      toast.success(`${referenceCode} is back in draft and off the calendar. Fix it and resubmit for review.`);
    },
    onError: (err) => toast.error(`Couldn't withdraw it: ${(err as Error).message}`),
  });
  const reopen = useMutation({
    mutationFn: (notes: string) => submissionService.reopen(submissionId, notes),
    onSuccess: () => {
      onSuccess();
      toast.success(`${referenceCode} reopened. The creator has been asked to make changes.`);
    },
    onError: (err) => toast.error(`Couldn't reopen it: ${(err as Error).message}`),
  });
  const reschedule = useMutation({
    mutationFn: (publishAt: string) => submissionService.reschedule(submissionId, publishAt),
    onSuccess: () => {
      onSuccess();
      toast.success(`${referenceCode} rescheduled.`);
    },
    onError: (err) => toast.error(`Couldn't reschedule it: ${(err as Error).message}`),
  });
  return { withdraw, reopen, reschedule };
}
