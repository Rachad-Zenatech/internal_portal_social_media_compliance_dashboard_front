import { apiClient } from "@/services/apiClient";
import type { ApprovalPath, ApprovalPathInput, ApprovalPathOptions } from "@/types/approvalPath";

export const approvalPathService = {
  list: () => apiClient.get<ApprovalPath[]>("/api/approval-paths"),
  options: () => apiClient.get<ApprovalPathOptions>("/api/approval-paths/options"),
  create: (data: ApprovalPathInput) => apiClient.post<ApprovalPath>("/api/approval-paths", data),
  update: (id: string, data: ApprovalPathInput) => apiClient.put<ApprovalPath>(`/api/approval-paths/${id}`, data),
  remove: (id: string) => apiClient.delete<null>(`/api/approval-paths/${id}`),
};
