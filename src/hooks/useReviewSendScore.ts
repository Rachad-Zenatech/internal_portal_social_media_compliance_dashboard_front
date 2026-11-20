import { useQuery } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";
import { reviewSendScore } from "@/lib/reviewSendScore";
import type { StoredCheck } from "@/types/submission";

/** Share the creator-request cache so sending updates immediately after a request is saved. */
export function useReviewSendScore(submissionId: string | null, check: StoredCheck | null | undefined, version: number) {
  const { data } = useQuery({
    queryKey: ["creator-flag-dismissals", submissionId],
    queryFn: () => submissionService.creatorFlagDismissals(submissionId!),
    enabled: Boolean(submissionId),
    staleTime: 0,
  });
  return reviewSendScore(check, data ?? [], version);
}
