import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { MoodVerdict } from "@/types/publicMood";

/** Public mood for a submission's topics, and the action that writes (or reuses) its summary. */
export function usePublicMood(submissionId?: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const key = ["public-mood", submissionId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => submissionService.getPublicMood(submissionId!),
    enabled: Boolean(submissionId) && enabled,
    // Topic snapshots refresh at most every few hours, so there's no need to refetch on every focus.
    staleTime: 5 * 60_000,
  });

  const usage = useQuery({
    queryKey: ["ai-usage", submissionId],
    queryFn: () => submissionService.aiUsage(submissionId!),
    enabled: Boolean(submissionId) && enabled,
    staleTime: 30_000,
  });

  const summarise = useMutation({
    mutationFn: () => submissionService.summarisePublicMood(submissionId!),
    onSuccess: (mood) => queryClient.setQueryData(key, mood),
    onError: (err) => toast.error(`Couldn't summarise the public mood: ${(err as Error).message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ai-usage"] }),
  });

  /** "This post isn't about that topic", or put it back. */
  const dismissTopic = useMutation({
    mutationFn: ({ topicId, restore }: { topicId: string; restore?: boolean }) =>
      restore ? submissionService.restoreMoodTopic(submissionId!, topicId) : submissionService.dismissMoodTopic(submissionId!, topicId),
    onSuccess: (mood) => {
      queryClient.setQueryData(key, mood);
      queryClient.invalidateQueries({ queryKey: ["listening-topics"] });
    },
    onError: (err) => toast.error(`Couldn't change the topics: ${(err as Error).message}`),
  });

  /** Whether the summary helped; no verdict takes the vote back. */
  const rate = useMutation({
    mutationFn: ({ summaryId, verdict }: { summaryId: string; verdict?: MoodVerdict }) =>
      submissionService.rateMoodSummary(submissionId!, summaryId, verdict),
    onSuccess: (mood) => queryClient.setQueryData(key, mood),
    onError: (err) => toast.error(`Couldn't save your rating: ${(err as Error).message}`),
  });

  return {
    mood: query.data ?? null,
    /** Check the topics again now (the server reuses topic data that's still fresh). */
    refresh: () => query.refetch(),
    dismissTopic,
    rate,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    summarise,
    usage: usage.data?.PUBLIC_MOOD ?? null,
  };
}
