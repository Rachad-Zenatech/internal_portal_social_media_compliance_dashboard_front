import { apiClient } from "@/services/apiClient";
import type { AiUsage, SentimentAnalysis } from "@/types/sentiment";
import type {
  ContentType,
  ReviewComment,
  ReviewCommentCreate,
  ReviewDecisionRequest,
  ReviewQueueItem,
  Submission,
  SubmissionFile,
  SubmissionFileKind,
  SubmissionHistory,
  SubmissionOptions,
  SubmissionSummary,
  SubmissionUpdate,
  SubmitResult,
} from "@/types/submission";

const quiet = { skipGlobalLoading: true };

export const submissionService = {
  getOptions: () => apiClient.get<SubmissionOptions>("/api/submissions/options"),

  /** "all" = everyone's content (super admins and Content Managers only). */
  list: (status?: string, scope: "mine" | "all" = "mine") => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (scope === "all") q.set("scope", "all");
    const qs = q.toString();
    return apiClient.get<SubmissionSummary[]>(`/api/submissions${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => apiClient.get<Submission>(`/api/submissions/${id}`),

  create: (title: string, contentType: ContentType) =>
    apiClient.post<Submission>("/api/submissions", { title, content_type: contentType }, quiet),

  /** Autosave and explicit saves both use this; it never shows the global loading overlay. */
  update: (id: string, data: SubmissionUpdate) => apiClient.patch<Submission>(`/api/submissions/${id}`, data, quiet),

  deleteDraft: (id: string) => apiClient.delete<null>(`/api/submissions/${id}`),

  uploadFile: (id: string, kind: SubmissionFileKind, file: File) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    return apiClient.post<SubmissionFile>(`/api/submissions/${id}/files`, form, quiet);
  },

  removeFile: (id: string, fileId: string) =>
    apiClient.delete<null>(`/api/submissions/${id}/files/${fileId}`, quiet),

  /** Regenerate a video's speech transcript (it's generated automatically after upload). */
  transcribe: (id: string, fileId: string) =>
    apiClient.post<SubmissionFile>(`/api/submissions/${id}/files/${fileId}/transcribe`, undefined, quiet),

  runCheck: (id: string) => apiClient.post<Submission>(`/api/submissions/${id}/check`, undefined, quiet),

  submit: (id: string) =>
    apiClient.post<SubmitResult>(`/api/submissions/${id}/submit`, undefined, {
      actionLabel: "Submitting for review",
      actionSubtitle: "Checking required information and running the rulebook check...",
    }),

  withdraw: (id: string) => apiClient.post<Submission>(`/api/submissions/${id}/withdraw`, undefined),

  history: (id: string) => apiClient.get<SubmissionHistory>(`/api/submissions/${id}/history`),

  /** Reviewer decision on the version in review. */
  review: (id: string, data: ReviewDecisionRequest) =>
    apiClient.post<Submission>(`/api/submissions/${id}/review`, data, quiet),

  comments: (id: string) => apiClient.get<ReviewComment[]>(`/api/submissions/${id}/comments`, quiet),

  addComment: (id: string, data: ReviewCommentCreate) =>
    apiClient.post<ReviewComment>(`/api/submissions/${id}/comments`, data, quiet),

  resolveComment: (id: string, commentId: string, resolved: boolean) =>
    apiClient.patch<ReviewComment>(`/api/submissions/${id}/comments/${commentId}`, { resolved }, quiet),

  deleteComment: (id: string, commentId: string) =>
    apiClient.delete<null>(`/api/submissions/${id}/comments/${commentId}`, quiet),

  /** Latest sentiment analysis, or null if none has run. */
  getSentiment: (id: string) => apiClient.get<SentimentAnalysis | null>(`/api/submissions/${id}/sentiment`, quiet),

  /** Start (or reuse) a sentiment analysis of the current content. */
  requestSentiment: (id: string) => apiClient.post<SentimentAnalysis>(`/api/submissions/${id}/sentiment`, undefined, quiet),

  /** AI runs left in the rolling 24-hour window, optionally including one submission's own limit. */
  aiUsage: (submissionId?: string) =>
    apiClient.get<AiUsage>(`/api/submissions/ai-usage${submissionId ? `?submission_id=${submissionId}` : ""}`, quiet),

  /** Submitted videos for the Content Screener queue. */
  reviewQueue: () => apiClient.get<ReviewQueueItem[]>("/api/submissions/review-queue"),

  /** Fetch a stored file as a blob URL (file URLs need the auth header, so <img src> can't load them directly). */
  async fileObjectUrl(url: string): Promise<string> {
    const token = sessionStorage.getItem("token");
    const res = await fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Couldn't load file (${res.status})`);
    return URL.createObjectURL(await res.blob());
  },
};
