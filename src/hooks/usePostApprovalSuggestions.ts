import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";
import { postSuggestionState, type SuggestionPost } from "@/lib/postApprovalSuggestions";

export function usePostApprovalSuggestions(post: SuggestionPost | null | undefined, mayCommentInReview = false) {
  const [now, setNow] = useState(Date.now);
  const state = postSuggestionState(post, now);
  const running = state.open || (state.reviewing && Number.isFinite(state.deadline));
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return { ...state, canComment: state.canComment || (mayCommentInReview && post?.status === "IN_REVIEW" && !state.pending) };
}

export function useApprovedPostAccess(submissionId?: string | null) {
  const query = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => submissionService.get(submissionId!),
    enabled: Boolean(submissionId), staleTime: 0, refetchInterval: 10_000,
  });
  const state = usePostApprovalSuggestions(query.data);
  return { ...state, post: query.data, isLoading: Boolean(submissionId && !query.data), isError: query.isError };
}
