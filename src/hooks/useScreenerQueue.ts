import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ANALYSING_REFETCH_MS, isAnalysing } from "@/components/submissions/submissionUi";
import { useSentToSprout } from "@/lib/contentCalendar";
import { splitApprovedQueue, type ScreenerTab } from "@/lib/screenerApprovalQueue";
import { submissionService } from "@/services/submissionService";

/** Keep the screener aligned with the creator's existing calendar scheduling workflow. */
export function useScreenerQueue(tab: ScreenerTab, scope: "all" | "mine") {
  const sent = useSentToSprout();
  const queryClient = useQueryClient();
  const decided = useQuery({
    queryKey: ["review-queue", "done", scope],
    queryFn: () => submissionService.reviewQueue("done", undefined, scope),
    staleTime: 0, refetchInterval: 10_000,
  });
  const activeTab = tab === "sent_back" ? "sent_back" : "review";
  const active = useQuery({
    queryKey: ["review-queue", activeTab, scope],
    queryFn: async () => {
      const posts = await submissionService.reviewQueue(activeTab, undefined, scope);
      await queryClient.fetchQuery({ queryKey: ["review-queue", "done", scope], queryFn: () => submissionService.reviewQueue("done", undefined, scope), staleTime: 0 });
      return posts;
    },
    enabled: tab === "review" || tab === "sent_back",
    staleTime: 0,
    refetchInterval: (q) => q.state.data?.some((post) => isAnalysing(post.latest_check)) ? ANALYSING_REFETCH_MS : 10_000,
  });
  const counts = useQuery({
    queryKey: ["review-queue", "counts", scope],
    queryFn: () => submissionService.reviewQueueCounts(scope),
    staleTime: 0,
  });
  const split = useMemo(() => splitApprovedQueue(decided.data ?? [], sent), [decided.data, sent]);
  const query = tab === "approved" || tab === "done" ? decided : active;
  const data = tab === "approved" ? split.approved : tab === "done" ? split.scheduled : active.data;
  return {
    decidedItems: decided.data ?? [],
    queue: { ...query, data },
    counts: { ...counts, data: counts.data && {
      ...counts.data, approved: decided.data ? split.approved.length : undefined,
      done: decided.data ? split.scheduled.length : undefined,
    } },
  };
}
