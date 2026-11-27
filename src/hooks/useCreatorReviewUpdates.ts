import { useQuery } from "@tanstack/react-query";
import { captionReviewService } from "@/services/captionReviewService";
import { postTextReviewService } from "@/services/postTextReviewService";
import { incomingCaptionChanges, incomingPostTextChanges } from "@/lib/creatorReviewUpdates";

export function useCreatorReviewUpdates(id: string | null, textOnly: boolean, version: number) {
  return useQuery({ queryKey: ["creator-review-updates", id, textOnly, version], enabled: Boolean(id),
    queryFn: async () => textOnly
      ? incomingPostTextChanges((await postTextReviewService.get(id!)).edits, version)
      : incomingCaptionChanges((await captionReviewService.get(id!)).revisions, version) });
}
