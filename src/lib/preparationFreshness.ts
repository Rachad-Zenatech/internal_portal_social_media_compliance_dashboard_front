import { analysisIsCurrent } from "./mediaFreshness";
import type { SentimentAnalysis } from "@/types/sentiment";

export function preparationCheckState({ skipSentiment = false, hasCheck, inputCheckStale, sentiment, mediaEditedAt, mediaChanged, hasMood, checkedAt, contentEditedAt }: {
  skipSentiment?: boolean; hasCheck: boolean; inputCheckStale: boolean; sentiment?: SentimentAnalysis | null;
  checkedAt?: string | null; contentEditedAt?: string | null;
  mediaEditedAt?: string | null; mediaChanged: boolean; hasMood: boolean;
}) {
  const cutoff = Math.max(...[contentEditedAt, mediaEditedAt].filter(Boolean).map(at => Date.parse(at!)));
  const fresh = (at?: string | null) => cutoff === -Infinity || Boolean(at && Date.parse(at) >= cutoff);
  return {
    compliance: hasCheck && !inputCheckStale && fresh(checkedAt),
    sentiment: skipSentiment || (fresh(sentiment?.created_at) && sentiment?.status === "COMPLETED" && sentiment.is_current && !mediaChanged &&
      analysisIsCurrent(sentiment.created_at, mediaEditedAt, sentiment.validated_media_edited_at)),
    mood: hasMood,
  };
}
