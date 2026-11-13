import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import { submissionService } from "@/services/submissionService";
import type { MoodVerdict } from "@/types/publicMood";

/**
 * Public mood for a submission's topics, and the action that writes (or reuses) its summary. It does not run by itself:
 * nothing is fetched until `run()` is called (a Run button), and a result already run in this session shows without
 * running it again. `hasRun` says whether there is anything to show. With `autoLoad` (a locked post) it loads what is
 * there to show.
 */
export function usePublicMood(submissionId?: string | null, enabled = true, autoLoad = false) {
  const queryClient = useQueryClient();
  const { addJob } = useGlobalProgress();
  const key = ["public-mood", submissionId];
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const requested = Boolean(submissionId) && requestedFor === submissionId;

  const query = useQuery({
    queryKey: key,
    queryFn: () => submissionService.getPublicMood(submissionId!),
    // autoLoad: a locked post (in review or approved) only shows what is there, so nothing is waiting on a Run button.
    enabled: Boolean(submissionId) && enabled && (requested || autoLoad),
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
    mutationFn: () => {
      const running = submissionService.summarisePublicMood(submissionId!);
      addJob("Checking for public mood", running, {
        type: "check",
        description: "Public mood summary",
        link_url: submissionId ? `/submissions/${submissionId}?step=mood` : undefined,
        doneMessage: "The public mood summary is done",
      });
      return running;
    },
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
    /** Run it (or run it again): the first time it is the only thing that loads the mood. */
    run: () => {
      setRequestedFor(submissionId ?? null);
      const running = queryClient.fetchQuery({ queryKey: key, queryFn: () => submissionService.getPublicMood(submissionId!), staleTime: 0 });
      addJob("Checking for public mood", running, {
        type: "check",
        description: "Public mood",
        link_url: submissionId ? `/submissions/${submissionId}?step=mood` : undefined,
        doneMessage: "The public mood check is done",
      });
      return running;
    },
    /** Whether it has been run (now, or earlier in this session). */
    hasRun: requested || autoLoad || query.data != null,
    dismissTopic,
    rate,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    summarise,
    usage: usage.data?.PUBLIC_MOOD ?? null,
  };
}

/** Live market & world-news trends scraped from X/news with VADER sentiment and POST/WAIT/HOLD recommendations. */
export function useMarketTrends(enabled = true) {
  return useQuery({
    queryKey: ["listening-trends"],
    queryFn: () => submissionService.listeningTrends(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Trigger live scraping of X / Twitter & news trends and refresh listening queries. */
export function useScrapeTwitter(_submissionId?: string | null, onAfterScrape?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    // The server scrapes in the background, so wait for it to finish before refreshing: refreshing straight
    // after "started" just shows the old data again.
    mutationFn: async () => {
      try {
        await submissionService.triggerScrapeTwitter();
      } catch (err) {
        // 409: one is already running (started elsewhere): wait for that one instead.
        if (!/already running/i.test((err as Error).message)) throw err;
      }
      const deadline = Date.now() + 12 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const status = await submissionService.scrapeStatus();
        if (status.state === "failed") throw new Error(status.error || "The scrape failed.");
        if (status.state === "finished") return status;
      }
      throw new Error("The scrape is still running after 12 minutes; check again later.");
    },
    onSuccess: (status) => {
      const sources = status.collection?.sources ?? [];
      const drafts = sources.filter((s) => s.kind === "post:news");
      const found = sources.reduce((n, s) => n + (s.items || 0), 0);
      toast.success(
        `Scrape finished: ${found} items from ${sources.length} searches` +
          (drafts.length ? ` (${drafts.length} from this app's drafts)` : " (no draft was searched)") +
          `, ${status.collection?.topics ?? 0} topics.`,
      );
      // Invalidate all public mood queries and global market trends
      queryClient.invalidateQueries({ queryKey: ["listening-trends"] });
      queryClient.invalidateQueries({ queryKey: ["listening-topics"] });
      queryClient.invalidateQueries({ queryKey: ["public-mood"] });
      onAfterScrape?.();
    },
    onError: (err) => {
      toast.error(`Scrape failed: ${(err as Error).message}`);
    },
  });
}
