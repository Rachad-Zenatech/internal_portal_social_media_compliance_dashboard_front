import { apiClient } from "@/services/apiClient";
import type {
  BulkResult, Capacity, DocDetail, DocDetails, DocHistory, DocPage, DocSetSummary, DocSummary, ReviewerOption, ScriptTemplate, Vote,
} from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";

const quiet = { skipGlobalLoading: true };

/** Scripts written from a template and reviewed live by several reviewers (see the backend's script_doc_service). */
export const scriptDocService = {
  templates: () => apiClient.get<ScriptTemplate[]>("/api/script-docs/templates", quiet),
  /** The creator's documents, each with its scripts as pages. */
  sets: () => apiClient.get<DocSetSummary[]>("/api/script-docs/sets", quiet),
  /** A new page (script) in the same document, with its own table. */
  addPage: (id: string) => apiClient.post<DocDetail>(`/api/script-docs/${id}/pages`, undefined, quiet),
  /** Attach a script: a new document made from an uploaded file, with a page for each script in it. */
  attach: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<{ created: DocPage[] }>("/api/script-docs/upload", form, quiet);
  },
  /** Send the document's scripts for review together (each is reviewed on its own). */
  submitPages: (id: string, data: { reviewers: { user_id: string; capacity: Capacity }[]; note?: string; ids?: string[] }) =>
    apiClient.post<BulkResult>(`/api/script-docs/${id}/pages/submit`, data, quiet),
  list: (scope: "mine" | "review" | "all") => apiClient.get<DocSummary[]>(`/api/script-docs?scope=${scope}`, quiet),
  create: (title: string, template_key: string) => apiClient.post<DocDetail>("/api/script-docs", { title, template_key }, quiet),
  get: (id: string) => apiClient.get<DocDetail>(`/api/script-docs/${id}`, quiet),
  update: (id: string, data: { title?: string; details?: DocDetails }) => apiClient.patch<DocDetail>(`/api/script-docs/${id}`, data, quiet),
  createPosts: (id: string) => apiClient.post<DocDetail>(`/api/script-docs/${id}/posts`, undefined, quiet),
  removeSet: (id: string) => apiClient.delete<void>(`/api/script-docs/sets/${id}`, quiet),
  remove: (id: string) => apiClient.delete<void>(`/api/script-docs/${id}`, quiet),
  /** Where the shared editor for this script is, and the short-lived sign-in for it. */
  sharedEditor: (id: string) =>
    apiClient.get<{ share_document_id: string; url: string; origin: string; token: string; expires_in: number }>(`/api/script-docs/${id}/shared-editor`, quiet),
  snapshot: (id: string, html: string, text: string) => apiClient.put<void>(`/api/script-docs/${id}/snapshot`, { html, text }, quiet),
  reviewers: (id: string) => apiClient.get<ReviewerOption[]>(`/api/script-docs/${id}/reviewers`, quiet),
  submit: (id: string, data: { reviewers: { user_id: string; capacity: Capacity }[]; note?: string; html?: string; text?: string }) =>
    apiClient.post<DocDetail>(`/api/script-docs/${id}/submit`, data, quiet),
  checkIn: (id: string, data: { vote: Vote; note?: string; pass_to_manager?: boolean }) =>
    apiClient.post<DocDetail>(`/api/script-docs/${id}/check-in`, data, quiet),
  withdrawCheckIn: (id: string) => apiClient.delete<DocDetail>(`/api/script-docs/${id}/check-in`, quiet),
  finalize: (id: string, route: "LEVEL2" | "CREATOR", note?: string) =>
    apiClient.post<DocDetail>(`/api/script-docs/${id}/finalize`, { route, note }, quiet),
  decide: (id: string, decision: "APPROVE" | "SEND_BACK", note?: string) =>
    apiClient.post<DocDetail>(`/api/script-docs/${id}/decision`, { decision, note }, quiet),
  history: (id: string) => apiClient.get<DocHistory>(`/api/script-docs/${id}/history`, quiet),
  check: (id: string, text?: string) => apiClient.post<StoredCheck>(`/api/script-docs/${id}/check`, text ? { text } : {}, quiet),
};
