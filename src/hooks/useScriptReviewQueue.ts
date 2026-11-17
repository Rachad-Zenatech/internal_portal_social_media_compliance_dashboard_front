import { useQuery } from "@tanstack/react-query";
import { scriptService } from "@/services/scriptService";
import type { ReviewTab } from "@/lib/scriptReviewLists";

export function useScriptReviewQueue(tab: ReviewTab, enabled: boolean) {
  const items = useQuery({
    queryKey: ["script-queue", tab], queryFn: () => scriptService.queue(tab), enabled, staleTime: 0,
  });
  const summary = useQuery({
    queryKey: ["script-queue", "summary"], queryFn: scriptService.queueSummary, enabled, staleTime: 0,
  });
  return { data: items.data, summary: summary.data ?? [],
    isLoading: items.isLoading || summary.isLoading, error: items.error ?? summary.error };
}
