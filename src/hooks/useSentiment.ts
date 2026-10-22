import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { SentimentAnalysis, SentimentStatus } from "@/types/sentiment";

const IN_PROGRESS: SentimentStatus[] = ["WAITING_TRANSCRIPT", "PENDING", "PROCESSING"];

export function isSentimentRunning(a?: SentimentAnalysis | null) {
  return Boolean(a && IN_PROGRESS.includes(a.status));
}

/** Latest sentiment analysis for a submission, checking back every few seconds while one is running. */
export function useSentiment(submissionId?: string | null, version?: number) {
  const queryClient = useQueryClient();
  const key = version != null ? ["sentiment", submissionId, version] : ["sentiment", submissionId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => submissionService.getSentiment(submissionId!, version),
    enabled: Boolean(submissionId),
    staleTime: 0,
    refetchInterval: (q) => (isSentimentRunning(q.state.data) ? 3000 : false),
  });

  // How many runs are left, so the button can say so instead of failing.
  const usage = useQuery({
    queryKey: ["ai-usage", submissionId],
    queryFn: () => submissionService.aiUsage(submissionId!),
    enabled: Boolean(submissionId),
    staleTime: 30_000,
  });

  const run = useMutation({
    mutationFn: () => submissionService.requestSentiment(submissionId!),
    onSuccess: (analysis) => queryClient.setQueryData(key, analysis),
    onError: (err) => toast.error(`Couldn't start sentiment analysis: ${(err as Error).message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ai-usage"] }),
  });

  return { analysis: query.data ?? null, isLoading: query.isLoading, run, usage: usage.data?.SENTIMENT ?? null };
}
