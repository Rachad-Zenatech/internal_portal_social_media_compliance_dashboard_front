import { apiClient } from "@/services/apiClient";
import type { FlagOutcome } from "@/types/flagOutcome";

export const flagOutcomeService = {
  list: (id: string) => apiClient.get<FlagOutcome[]>(`/api/submissions/${id}/flag-outcomes`, { skipGlobalLoading: true }),
};
