import { apiClient } from "@/services/apiClient";
import type { CaptionEditRequest, CaptionReview } from "@/types/captionEdit";

const quiet = { skipGlobalLoading: true };
export const captionReviewService = {
  get: (id: string, signal?: AbortSignal) => apiClient.get<CaptionReview>(`/api/submissions/${id}/caption-review`, { ...quiet, signal }),
  save: (id: string, data: CaptionEditRequest) =>
    apiClient.patch<CaptionReview>(`/api/submissions/${id}/caption-review`, data, quiet),
};
