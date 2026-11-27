import { useQuery } from "@tanstack/react-query";
import { flagOutcomeService } from "@/services/flagOutcomeService";

export function useFlagOutcomes(submissionId: string, enabled = true) {
  return useQuery({
    queryKey: ["flag-outcomes", submissionId],
    queryFn: () => flagOutcomeService.list(submissionId),
    staleTime: 0,
    enabled,
  });
}
