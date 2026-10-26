import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { performanceService } from "@/services/performanceService";
import type { PerformanceFilters } from "@/types/performance";

/** Live posts' numbers and health for the filters; numbers refresh on the server every few hours. */
export function usePerformance(filters: PerformanceFilters) {
  const query = useQuery({
    queryKey: ["performance", filters],
    queryFn: () => performanceService.report(filters),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  return { report: query.data ?? null, isLoading: query.isLoading, isFetching: query.isFetching, error: query.error as Error | null };
}
