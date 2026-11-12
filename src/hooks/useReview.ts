import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { FlagVerdict, FlagDismissReason, FlagReview, ReviewCommentCreate, ReviewDecisionRequest } from "@/types/submission";

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
/** Reviewers' dismissals of automated flags, and the calls to dismiss or restore one on the version in review. */
export function useFlagReviews(submissionId: string, currentVersion: number) {
  const queryClient = useQueryClient();
  const key = ["flag-reviews", submissionId];
  const query = useQuery({ queryKey: key, queryFn: () => submissionService.flags(submissionId), staleTime: 0 });
  const forCurrent = new Map<string, FlagReview>(
    (query.data ?? []).filter((r) => r.version_number === currentVersion).map((r) => [r.rule_id, r])
  );
  const verdictKey = ["flag-verdicts", submissionId];
  const verdicts = useQuery({ queryKey: verdictKey, queryFn: () => submissionService.flagVerdicts(submissionId), staleTime: 0 });
  // The flags a reviewer has confirmed as right on this version.
  const confirmed = new Map<string, FlagVerdict>(
    (verdicts.data ?? []).filter((v) => v.version_number === currentVersion && v.verdict === "CORRECT").map((v): [string, FlagVerdict] => [v.rule_id, v])
  );
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: verdictKey });
    // Open critical flags decide whether it can be approved.
    invalidateSubmission(queryClient, submissionId);
    queryClient.invalidateQueries({ queryKey: ["compliance-rules"] });
  };
  const dismiss = useMutation({
    mutationFn: (v: { ruleId: string; reason: FlagDismissReason; note: string | null }) =>
      submissionService.dismissFlag(submissionId, v.ruleId, { reason: v.reason, note: v.note }),
    onSuccess: (r) => {
      refresh();
      toast.success(`${r.rule_number} flag dismissed: ${r.reason_label.toLowerCase()}.`);
    },
    onError: (err) => toast.error(`Couldn't dismiss the flag: ${(err as Error).message}`),
  });
  const restore = useMutation({
    mutationFn: (ruleId: string) => submissionService.restoreFlag(submissionId, ruleId),
    onSuccess: () => {
      refresh();
      toast.success("Flag restored.");
    },
    onError: (err) => toast.error(`Couldn't restore the flag: ${(err as Error).message}`),
  });
  const confirm = useMutation({
    mutationFn: (v: { ruleId: string; note?: string | null }) => submissionService.confirmFlag(submissionId, v.ruleId, v.note ?? null),
    onSuccess: (r) => {
      refresh();
      toast.success(`${r.rule_number} flag marked as right. It is kept as an example for the check.`);
    },
    onError: (err) => toast.error(`Couldn't save that: ${(err as Error).message}`),
  });
  const unconfirm = useMutation({
    mutationFn: (ruleId: string) => submissionService.unconfirmFlag(submissionId, ruleId),
    onSuccess: () => {
      refresh();
      toast.success("Confirmation removed.");
    },
    onError: (err) => toast.error(`Couldn't remove it: ${(err as Error).message}`),
  });
  return { reviews: query.data ?? [], forCurrent, dismiss, restore, confirmed, confirm, unconfirm };
}

export function useReviewDecision(submissionId: string, referenceCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReviewDecisionRequest) => submissionService.review(submissionId, data),
    onSuccess: (_, data) => {
      invalidateSubmission(queryClient, submissionId);
      if (data.decision === "REQUEST_CHANGES") toast.success(`${referenceCode} sent back with your comments. The creator has been notified.`);
      else if (data.publish_now) toast.success(`${referenceCode} approved and ready for the creator to publish.`);
      else toast.success(`${referenceCode} approved and added to the content calendar.`);
    },
    onError: (err) => toast.error(`Couldn't save your decision: ${(err as Error).message}`),
  });
}

/** Approved content: a reviewer reschedules it or reopens it for changes. */
export function useApprovalActions(submissionId: string, referenceCode: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateSubmission(queryClient, submissionId);
  const reopen = useMutation({
    mutationFn: ({ notes, days, at }: { notes: string; days?: 1 | 2 | 3 | 5; at?: string }) =>
      submissionService.reopen(submissionId, notes, { revision_days: days, revision_due_at: at }),
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
  return { reopen, reschedule };
}
