import { apiClient } from "@/services/apiClient";
import type { CaptionSuggestions } from "@/types/caption";
import type { MoodVerdict, PublicMood } from "@/types/publicMood";
import type {
  AiUsage,
  FindingFeedback,
  FindingVerdict,
  SentimentAnalysis,
  SentimentAssessment,
  SentimentEvalCase,
  SentimentLevel,
} from "@/types/sentiment";
import type {
  ContentType,
  DashboardSummary,
  FlagDismissReason,
  FlagReview,
  QueueTab,
  ReviewComment,
  ReviewCommentCreate,
  ReviewDecisionRequest,
  ReviewQueueCounts,
  ReviewQueueItem,
  VersionView,
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

  /** Back to draft: from review, or after approval for a late fix (the approval then no longer applies). */
  withdraw: (id: string) => apiClient.post<Submission>(`/api/submissions/${id}/withdraw`, undefined),

  /** Reviewer takes back an approval and sends it to the creator as changes requested. */
  reopen: (id: string, notes: string, revisionDays?: 1 | 2 | 3 | 5) =>
    apiClient.post<Submission>(`/api/submissions/${id}/reopen`, { notes, revision_days: revisionDays }, quiet),

  /** Reviewer moves approved content to a new publish time. */
  reschedule: (id: string, publishAt: string) =>
    apiClient.post<Submission>(`/api/submissions/${id}/reschedule`, { publish_at: publishAt }, quiet),

  history: (id: string) => apiClient.get<SubmissionHistory>(`/api/submissions/${id}/history`),

  /** Reviewer decision on the version in review. */
  review: (id: string, data: ReviewDecisionRequest) =>
    apiClient.post<Submission>(`/api/submissions/${id}/review`, data, quiet),

  comments: (id: string) => apiClient.get<ReviewComment[]>(`/api/submissions/${id}/comments`, quiet),

  /** Reviewers' dismissals of automated compliance flags, on every version. */
  flags: (id: string) => apiClient.get<FlagReview[]>(`/api/submissions/${id}/flags`, quiet),
  dismissFlag: (id: string, ruleId: string, data: { reason: FlagDismissReason; note: string | null }) =>
    apiClient.put<FlagReview>(`/api/submissions/${id}/flags/${ruleId}`, data, quiet),
  restoreFlag: (id: string, ruleId: string) => apiClient.delete<null>(`/api/submissions/${id}/flags/${ruleId}`, quiet),

  addComment: (id: string, data: ReviewCommentCreate) =>
    apiClient.post<ReviewComment>(`/api/submissions/${id}/comments`, data, quiet),

  resolveComment: (id: string, commentId: string, resolved: boolean) =>
    apiClient.patch<ReviewComment>(`/api/submissions/${id}/comments/${commentId}`, { resolved }, quiet),

  deleteComment: (id: string, commentId: string) =>
    apiClient.delete<null>(`/api/submissions/${id}/comments/${commentId}`, quiet),

  /** Latest sentiment analysis, or null if none has run. */
  getSentiment: (id: string, version?: number) =>
    apiClient.get<SentimentAnalysis | null>(
      `/api/submissions/${id}/sentiment${version != null ? `?version=${version}` : ""}`,
      quiet
    ),

  /** Three captions drafted from the post (images, the video itself, its transcript, title), each already compliance-checked. */
  suggestCaptions: (id: string, data: { hint?: string; max_chars: number }) =>
    apiClient.post<CaptionSuggestions>(`/api/submissions/${id}/caption-suggestions`, data, quiet),

  /** How people online feel about the topics this post touches (social listening), with any saved summary. */
  getPublicMood: (id: string) => apiClient.get<PublicMood>(`/api/submissions/${id}/public-mood`, quiet),

  /** Write (or reuse) the AI reading of how this post may land given the current mood. */
  summarisePublicMood: (id: string) => apiClient.post<PublicMood>(`/api/submissions/${id}/public-mood/summary`, undefined, quiet),

  /** "This post isn't about that topic" (or put it back). */
  dismissMoodTopic: (id: string, topicId: string) =>
    apiClient.put<PublicMood>(`/api/submissions/${id}/public-mood/topics/${topicId}/dismissal`, undefined, quiet),
  restoreMoodTopic: (id: string, topicId: string) =>
    apiClient.delete<PublicMood>(`/api/submissions/${id}/public-mood/topics/${topicId}/dismissal`, quiet),

  /** Whether the public mood summary helped; no verdict takes the vote back. */
  rateMoodSummary: (id: string, summaryId: string, verdict?: MoodVerdict) =>
    verdict
      ? apiClient.put<PublicMood>(`/api/submissions/${id}/public-mood/summary/${summaryId}/feedback`, { verdict }, quiet)
      : apiClient.delete<PublicMood>(`/api/submissions/${id}/public-mood/summary/${summaryId}/feedback`, quiet),

  /** One submitted version as it was (snapshot, video, automated check, decision). */
  getVersion: (id: string, version: number) => apiClient.get<VersionView>(`/api/submissions/${id}/versions/${version}`, quiet),

  /** Start (or reuse) a sentiment analysis of the current content. */
  requestSentiment: (id: string) => apiClient.post<SentimentAnalysis>(`/api/submissions/${id}/sentiment`, undefined, quiet),

  /** Run an analysis stopped by Gemini's daily limit again once the limit resets. */
  scheduleSentiment: (id: string, analysisId: string) =>
    apiClient.post<SentimentAnalysis>(`/api/submissions/${id}/sentiment/${analysisId}/schedule`, undefined, quiet),

  /** The analysed video's frame at a moment, for a finding (load it with authedFileUrl). */
  sentimentFrameUrl: (id: string, analysisId: string, atSec: number) =>
    `/api/submissions/${id}/sentiment/${analysisId}/frame?t=${Math.max(0, Math.round(atSec * 10) / 10)}`,

  /** One of the images the analysis looked at (1 = the first; load it with authedFileUrl). */
  sentimentImageUrl: (id: string, analysisId: string, index: number) => `/api/submissions/${id}/sentiment/${analysisId}/images/${index}`,

  /** A reviewer's vote on one finding ("useful" / "not an issue"); returns every finding's tallies. */
  rateFinding: (id: string, analysisId: string, findingId: string, verdict: FindingVerdict, note?: string) =>
    apiClient.put<Record<string, FindingFeedback>>(
      `/api/submissions/${id}/sentiment/${analysisId}/findings/${findingId}/feedback`,
      { verdict, note: note || null },
      quiet
    ),

  clearFindingRating: (id: string, analysisId: string, findingId: string) =>
    apiClient.delete<Record<string, FindingFeedback>>(`/api/submissions/${id}/sentiment/${analysisId}/findings/${findingId}/feedback`, quiet),

  /** Save an analysed post as a test case with the verdict the reviewer agrees is right. */
  saveSentimentTestCase: (data: { analysis_id: string; expected_assessment: SentimentAssessment; expected_concern?: SentimentLevel | null; notes?: string }) =>
    apiClient.post<SentimentEvalCase>("/api/sentiment/eval-cases", data, quiet),

  /** AI runs left in the rolling 24-hour window, optionally including one submission's own limit. */
  aiUsage: (submissionId?: string) =>
    apiClient.get<AiUsage>(`/api/submissions/ai-usage${submissionId ? `?submission_id=${submissionId}` : ""}`, quiet),

  /** Submitted videos for the Content Screener queue. */
  /** scope "mine": only the user's own content, as its creator (a super admin viewing the app as a creator). */
  reviewQueue: (tab: QueueTab = "review", search?: string, scope: "all" | "mine" = "all") =>
    apiClient.get<ReviewQueueItem[]>(
      `/api/submissions/review-queue?tab=${tab}&scope=${scope}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),

  reviewQueueCounts: (scope: "all" | "mine" = "all") =>
    apiClient.get<ReviewQueueCounts>(`/api/submissions/review-queue/counts?scope=${scope}`),

  /** Recent activity and last-30-days compliance insights for the dashboard. */
  dashboard: (scope: "all" | "mine" = "all") => apiClient.get<DashboardSummary>(`/api/submissions/dashboard?scope=${scope}`, quiet),

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
