import { useQuery } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";

/** Returning from a workflow action must show its activity; polling catches other sessions too. */
export function useDashboardSummary(scope: "all" | "mine") {
  return useQuery({
    queryKey: ["dashboard-summary", scope],
    queryFn: () => submissionService.dashboard(scope),
    select: (summary) => ({ ...summary, activity: summary.activity.filter((item) => item.action.trim().toLowerCase() !== "commented on") }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}
