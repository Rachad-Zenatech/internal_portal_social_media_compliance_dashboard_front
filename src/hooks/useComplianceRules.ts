import { useQuery } from "@tanstack/react-query";

import { complianceService } from "@/services/complianceService";

/** Every compliance rule, fetched once and shared, for looking up a flag's rule text. */
export function useComplianceRules() {
  return useQuery({
    queryKey: ["compliance-rules", "all"],
    queryFn: () => complianceService.getRules(),
    staleTime: 5 * 60_000,
  });
}
