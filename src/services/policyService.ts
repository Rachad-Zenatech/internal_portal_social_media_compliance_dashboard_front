import { apiClient } from "@/services/apiClient";
import type { PolicyOverview, PolicyRuleProposal, ProposalStatus, ProposalUpdate } from "@/types/policy";

const quiet = { skipGlobalLoading: true };
const BASE = "/api/compliance/policies";

/** Social Media Content Policy: read the platforms' policy pages and approve the rules proposed from them. */
export const policyService = {
  overview: () => apiClient.get<PolicyOverview>(BASE, quiet),

  /** Read every page in the background; pages whose text changed get new proposals. */
  refreshAll: (repropose = false) =>
    apiClient.post<{ started: boolean; detail?: string }>(`${BASE}/refresh${repropose ? "?repropose=true" : ""}`, undefined, quiet),

  fetchPage: (pageId: string) =>
    apiClient.post<{ changed: boolean; status: string }>(`${BASE}/pages/${pageId}/fetch`, undefined, {
      actionLabel: "Reading the policy page",
      actionSubtitle: "Proposing rules with AI if it changed...",
    }),

  /** The policy's text, pasted for a page that won't load here. */
  pasteText: (pageId: string, text: string) =>
    apiClient.post<{ changed: boolean }>(`${BASE}/pages/${pageId}/text`, { text }),

  propose: (pageId: string) => apiClient.post<{ started: boolean }>(`${BASE}/pages/${pageId}/propose`, undefined, quiet),

  proposals: (status?: ProposalStatus) =>
    apiClient.get<PolicyRuleProposal[]>(`${BASE}/proposals${status ? `?status=${status}` : ""}`, quiet),

  update: (id: string, data: ProposalUpdate) => apiClient.patch<PolicyRuleProposal>(`${BASE}/proposals/${id}`, data),

  approve: (id: string, note?: string) =>
    apiClient.post<PolicyRuleProposal>(`${BASE}/proposals/${id}/approve`, note ? { note } : undefined),

  reject: (id: string, note?: string) =>
    apiClient.post<PolicyRuleProposal>(`${BASE}/proposals/${id}/reject`, note ? { note } : undefined),
};
