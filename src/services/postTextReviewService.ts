import { apiClient } from "@/services/apiClient";
import type { PostTextReview, PostTextSave } from "@/types/postTextReview";

export const postTextReviewService = {
  get: (id: string) => apiClient.get<PostTextReview>(`/api/submissions/${id}/text-review`, { skipGlobalLoading: true }),
  save: (id: string, data: PostTextSave) => apiClient.post<PostTextReview>(`/api/submissions/${id}/text-review`, data),
};
