import { analysisIsCurrent } from "./mediaFreshness";
import type { SentimentAnalysis } from "@/types/sentiment";

export function preparationCheckState({ hasCheck, inputCheckStale, sentiment, mediaEditedAt, mediaChanged, hasMood }: {
  hasCheck: boolean; inputCheckStale: boolean; sentiment?: SentimentAnalysis | null;
  mediaEditedAt?: string | null; mediaChanged: boolean; hasMood: boolean;
}) {
  return {
    compliance: hasCheck && !inputCheckStale,
    sentiment: sentiment?.status === "COMPLETED" && sentiment.is_current && !mediaChanged &&
      analysisIsCurrent(sentiment.created_at, mediaEditedAt, sentiment.validated_media_edited_at),
    mood: hasMood,
  };
}
