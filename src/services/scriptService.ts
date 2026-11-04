import { apiClient } from "@/services/apiClient";
import type { ScriptQueueItem, ScriptStage } from "@/types/script";
import type { StoredCheck } from "@/types/submission";

const quiet = { skipGlobalLoading: true };

/** The script stage of video posts (see the backend's script_review_service). */
export const scriptService = {
  queue: (tab: "review" | "sent_back" | "done" = "review") =>
    apiClient.get<ScriptQueueItem[]>(`/api/submissions/scripts/queue?tab=${tab}`, quiet),

  get: (id: string) => apiClient.get<ScriptStage>(`/api/submissions/${id}/script`, quiet),

  /** Send the uploaded script for review. */
  submit: (id: string) => apiClient.post<ScriptStage>(`/api/submissions/${id}/script/submit`, undefined, quiet),

  /** Reviewer: approve, or send back with a note and/or their edited version (text). */
  decide: (id: string, data: { decision: "APPROVE" | "SEND_BACK"; text?: string; note?: string; due_days?: 1 | 2 | 3 | 5; due_at?: string }) =>
    apiClient.post<ScriptStage>(`/api/submissions/${id}/script/decision`, data, quiet),

  /** Creator: accept the reviewer's edits. */
  accept: (id: string) => apiClient.post<ScriptStage>(`/api/submissions/${id}/script/accept`, undefined, quiet),

  /** Creator: send an edited script back to the reviewer. */
  revise: (id: string, text: string, note?: string) =>
    apiClient.post<ScriptStage>(`/api/submissions/${id}/script/revise`, { text, note }, quiet),

  /** Check wording being edited, without saving it. */
  check: (id: string, text: string) => apiClient.post<StoredCheck>(`/api/submissions/${id}/script/check`, { text }, quiet),
};
