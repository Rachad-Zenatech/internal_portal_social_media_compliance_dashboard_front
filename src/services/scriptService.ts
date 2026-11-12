import { apiClient } from "@/services/apiClient";
import type { ScriptQueueItem, ScriptStage } from "@/types/script";
import type { ScriptHighlight } from "@/types/script";
import type { StoredCheck } from "@/types/submission";

const quiet = { skipGlobalLoading: true };

/** The script stage of video posts (see the backend's script_review_service). */
export const scriptService = {
  queue: (tab: "review" | "sent_back" | "done" = "review") =>
    apiClient.get<ScriptQueueItem[]>(`/api/submissions/scripts/queue?tab=${tab}`, quiet),

  get: (id: string) => apiClient.get<ScriptStage>(`/api/submissions/${id}/script`, quiet),

  /** Send the uploaded script for review. confirmRepost: send the same script again for another publish date (the
   * server asks with a 409 REPOST_CONFIRM; the same script for the same place and date is a 409 DUPLICATE_SCRIPT). */
  submit: (id: string, confirmRepost = false) =>
    apiClient.post<ScriptStage>(`/api/submissions/${id}/script/submit`, { confirm_repost: confirmRepost }, quiet),

  /** Reviewer: approve, or send back with a note and/or their edited version (text). */
  decide: (id: string, data: { decision: "APPROVE" | "SEND_BACK"; text?: string; note?: string; due_days?: 1 | 2 | 3 | 5; due_at?: string }) =>
    apiClient.post<ScriptStage>(`/api/submissions/${id}/script/decision`, data, quiet),

  /** Suggesting reviewer: save their edited wording and notes (theirs alone for now). */
  saveSuggestion: (id: string, data: { text: string; highlights: ScriptHighlight[] }) =>
    apiClient.put<ScriptStage>(`/api/submissions/${id}/script/suggestion`, data, quiet),

  /** Suggesting reviewer: take their suggestion back. */
  discardSuggestion: (id: string) => apiClient.delete<ScriptStage>(`/api/submissions/${id}/script/suggestion`, quiet),

  /** Creator: accept the reviewer's edits. */
  accept: (id: string) => apiClient.post<ScriptStage>(`/api/submissions/${id}/script/accept`, undefined, quiet),

  /** Creator: send an edited script back to the reviewer. */
  revise: (id: string, text: string, note?: string, confirmRepost = false) =>
    apiClient.post<ScriptStage>(`/api/submissions/${id}/script/revise`, { text, note, confirm_repost: confirmRepost }, quiet),

  /** Check wording being edited, without saving it. */
  /** A compliant rewrite of one flagged passage, for the creator to use or not. */
  suggestFix: (data: { passage: string; flagged_terms: string[]; rule_title: string; explanation?: string | null; guidance?: string | null }) =>
    apiClient.post<{ rewrite: string; note?: string | null }>("/api/submissions/scripts/suggest-fix", data, quiet),
  /** Creator: check the uploaded script against the rulebook before sending it (the result is kept). */
  precheck: (id: string) => apiClient.post<ScriptStage>(`/api/submissions/${id}/script/precheck`, undefined, quiet),
  check: (id: string, text: string) => apiClient.post<StoredCheck>(`/api/submissions/${id}/script/check`, { text }, quiet),

  /** The reviewer's highlights and notes on a script version (the creator sees them too). */
  highlights: (id: string, version: number) =>
    apiClient.get<ScriptHighlight[]>(`/api/submissions/${id}/script/highlights?version=${version}`, quiet),

  /** Creator: mark the reviewer's highlights they fixed, with the wording as it reads now. */
  resolveHighlights: (id: string, version: number, resolutions: { id: string; done: boolean; updated?: string | null }[]) =>
    apiClient.post<ScriptHighlight[]>(`/api/submissions/${id}/script/highlights/resolve?version=${version}`, { resolutions }, quiet),

  /** Reviewer: save the highlights and notes on a script version. */
  saveHighlights: (id: string, version: number, highlights: ScriptHighlight[]) =>
    apiClient.put<ScriptHighlight[]>(`/api/submissions/${id}/script/highlights?version=${version}`, { highlights }, quiet),
};
