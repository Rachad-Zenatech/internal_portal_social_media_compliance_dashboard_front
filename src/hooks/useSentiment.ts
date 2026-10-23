import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { FindingVerdict, SentimentAnalysis, SentimentStatus } from "@/types/sentiment";

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
    // A run scheduled for after Gemini's limit resets is started by the server; check back now and then.
    refetchInterval: (q) => (isSentimentRunning(q.state.data) ? 3000 : q.state.data?.status === "SCHEDULED" ? 60_000 : false),
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

  /** After Gemini's daily limit: run it again automatically once the limit resets. */
  const scheduleAfterReset = useMutation({
    mutationFn: (analysisId: string) => submissionService.scheduleSentiment(submissionId!, analysisId),
    onSuccess: (analysis) => {
      queryClient.setQueryData(key, analysis);
      toast.success("Scheduled. It runs automatically once Gemini's daily limit resets.");
    },
    onError: (err) => toast.error(`Couldn't schedule it: ${(err as Error).message}`),
  });

  /** A reviewer's vote on a finding; no verdict takes the vote back. */
  const rate = useMutation({
    mutationFn: ({ analysisId, findingId, verdict }: { analysisId: string; findingId: string; verdict?: FindingVerdict }) =>
      verdict
        ? submissionService.rateFinding(submissionId!, analysisId, findingId, verdict)
        : submissionService.clearFindingRating(submissionId!, analysisId, findingId),
    onSuccess: (feedback) => queryClient.setQueryData<SentimentAnalysis | null>(key, (prev) => (prev ? { ...prev, feedback } : prev)),
    onError: (err) => toast.error(`Couldn't save your rating: ${(err as Error).message}`),
  });

  const saveTestCase = useMutation({
    mutationFn: submissionService.saveSentimentTestCase,
    onSuccess: (c) => {
      const rated = c.must_flag.length + c.must_not_flag.length;
      toast.success(
        `Saved as a test case${rated ? ` with ${rated} rated finding${rated === 1 ? "" : "s"}` : ""}. It's re-checked whenever the prompt or model changes.`
      );
    },
    onError: (err) => toast.error(`Couldn't save the test case: ${(err as Error).message}`),
  });

  return {
    analysis: query.data ?? null,
    isLoading: query.isLoading,
    run,
    scheduleAfterReset,
    rate,
    saveTestCase,
    usage: usage.data?.SENTIMENT ?? null,
  };
}
