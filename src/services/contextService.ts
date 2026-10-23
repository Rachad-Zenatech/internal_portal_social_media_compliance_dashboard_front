import { apiClient } from "@/services/apiClient";
import type { ContextEntry, ContextEntryInput } from "@/types/context";

export const contextService = {
  list: () => apiClient.get<ContextEntry[]>("/api/messaging-context"),
  create: (data: ContextEntryInput) => apiClient.post<ContextEntry>("/api/messaging-context", data),
  update: (id: string, data: ContextEntryInput) => apiClient.put<ContextEntry>(`/api/messaging-context/${id}`, data),
  remove: (id: string) => apiClient.delete<null>(`/api/messaging-context/${id}`),
};
