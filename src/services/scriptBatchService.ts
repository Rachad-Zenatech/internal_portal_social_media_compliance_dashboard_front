import { apiClient } from "@/services/apiClient";
import type { Batch, BatchDetails, BatchReviewResult, BatchSummary, ItemDecision } from "@/types/scriptBatch";

const quiet = { skipGlobalLoading: true };

/** Scripts uploaded together, reviewed together (see the backend's script_batch_service). */
export const scriptBatchService = {
  list: (scope: "mine" | "review" = "mine") => apiClient.get<BatchSummary[]>(`/api/script-batches?scope=${scope}`, quiet),

  get: (id: string) => apiClient.get<Batch>(`/api/script-batches/${id}`, quiet),

  /** Upload one document holding several scripts; it comes back split into scripts. */
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<Batch>("/api/script-batches", form, quiet);
  },

  update: (id: string, data: { title?: string; details?: BatchDetails; per_script_details?: boolean }) =>
    apiClient.patch<Batch>(`/api/script-batches/${id}`, data, quiet),

  remove: (id: string) => apiClient.delete<null>(`/api/script-batches/${id}`, quiet),

  addItem: (id: string, data: { title: string; body: string }) =>
    apiClient.post<Batch>(`/api/script-batches/${id}/items`, data, quiet),

  updateItem: (id: string, itemId: string, data: { title?: string; body?: string; details?: BatchDetails }) =>
    apiClient.patch<Batch>(`/api/script-batches/${id}/items/${itemId}`, data, quiet),

  removeItem: (id: string, itemId: string) => apiClient.delete<Batch>(`/api/script-batches/${id}/items/${itemId}`, quiet),

  /** Check one script against the rulebook before sending it (the result is kept and reused on send). */
  checkItem: (id: string, itemId: string) => apiClient.post<Batch>(`/api/script-batches/${id}/items/${itemId}/check`, undefined, quiet),
  /** Send the waiting scripts to the reviewers; they are checked in the background. */
  send: (id: string) => apiClient.post<Batch>(`/api/script-batches/${id}/send`, undefined, quiet),

  /** Reviewer: approve or send back any number of the scripts at once. */
  review: (id: string, data: { decisions: ItemDecision[]; due_days?: number; due_at?: string }) =>
    apiClient.post<BatchReviewResult>(`/api/script-batches/${id}/review`, data, quiet),
};
