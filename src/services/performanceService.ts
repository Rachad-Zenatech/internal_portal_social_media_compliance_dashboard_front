import { apiClient } from "@/services/apiClient";
import type { PerformanceFilters, PerformanceReport } from "@/types/performance";

export const performanceService = {
  report: ({ days, platform, brand, mine }: PerformanceFilters) => {
    const params = new URLSearchParams({ days: String(days) });
    if (platform) params.set("platform", platform);
    if (brand) params.set("brand", brand);
    // Left out, the server picks: the team's posts for reviewers and managers, your own for creators.
    if (mine !== undefined) params.set("mine", String(mine));
    return apiClient.get<PerformanceReport>(`/api/performance?${params}`);
  },
};
