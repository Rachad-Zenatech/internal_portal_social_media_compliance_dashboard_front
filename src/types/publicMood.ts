/** Public mood: how people online currently feel about the topics a post touches (social listening). */

export type PublishingRecommendation = "POST" | "WAIT" | "HOLD";

export interface ListeningPost {
  network: string;
  author: string;
  text: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  confidence?: number | null;
  engagements: number;
  posted_on?: string | null;
}

export interface TopicSnapshot {
  id: string;
  window_days: number;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  /** Positive minus negative, -100 to 100. */
  net_sentiment: number;
  volume: number;
  volume_change_pct?: number | null;
  is_spike: boolean;
  daily_volume: number[];
  top_posts: ListeningPost[];
  recommendation?: PublishingRecommendation | null;
  recommendation_reason?: string | null;
  fetched_at: string;
}

export interface MatchedTopic {
  topic_id: string;
  name: string;
  /** The words in the post that tied it to this topic. */
  matched_terms: string[];
  /** How close the post is to the topic in meaning (0-1), when matched by meaning too. */
  similarity?: number | null;
  matched_by: "KEYWORD" | "MEANING" | "BOTH";
  /** own: searched from this post. context: the wider topic (the vibe; not part of the post's recommendation). */
  kind?: "own" | "context" | "other";
  snapshot?: TopicSnapshot | null;
}

export type PublicMoodOverall = "FAVOURABLE" | "MIXED" | "UNFAVOURABLE" | "NO_DATA";

export interface PublicMoodResult {
  overall: PublicMoodOverall;
  recommendation?: PublishingRecommendation | null;
  recommendation_reason?: string | null;
  headline: string;
  topics: { topic: string; reading: string; risk: "LOW" | "MEDIUM" | "HIGH" }[];
  risks: string[];
  opportunities: string[];
  timing_note?: string | null;
}

export interface PublicMoodSummary {
  id: string;
  version_number: number;
  result: PublicMoodResult;
  model?: string | null;
  is_mock: boolean;
  created_at: string;
  /** The post or the topics' moods changed since it was written. */
  is_stale: boolean;
  useful_count: number;
  not_useful_count: number;
  my_verdict?: MoodVerdict | null;
}

export interface ProcessStep {
  title: string;
  status: "ok" | "warn" | "none" | "info";
  summary: string;
  lines: string[];
}

export interface PublicMood {
  source: string;
  is_mock: boolean;
  connected: boolean;
  matched_by_meaning: boolean;
  message?: string | null;
  topics: MatchedTopic[];
  /** Topics someone said this post isn't about; left out until put back. */
  dismissed: DismissedTopic[];
  summary?: PublicMoodSummary | null;
  /** How this was made, step by step. */
  process?: ProcessStep[];
}

export type MoodVerdict = "USEFUL" | "NOT_USEFUL";

export interface DismissedTopic {
  topic_id: string;
  name: string;
  by_name?: string | null;
  at: string;
}

export interface ListeningTopic {
  id: string;
  name: string;
  description?: string | null;
  /** From the listening source. */
  keywords: string[];
  /** The team's own: extra words that mean this topic, and source keywords that don't count. */
  extra_keywords: string[];
  excluded_keywords: string[];
  is_watched: boolean;
  is_mock: boolean;
  synced_at: string;
  snapshot?: TopicSnapshot | null;
  /** Times someone said a post matched to this topic wasn't about it. */
  dismissed_count: number;
  /** The keywords behind those wrong matches, most frequent first. */
  dismissed_terms: string[];
}

export interface ListeningTopicUpdate {
  extra_keywords: string[];
  excluded_keywords: string[];
  is_watched: boolean;
}

export interface MatchTestTopic {
  topic_id: string;
  name: string;
  matched: boolean;
  matched_terms: string[];
  similarity?: number | null;
  /** Lead over the text's median topic score; what decides a match by meaning. */
  margin?: number | null;
  reason: string;
}

export interface MatchTestResult {
  matched_by_meaning: boolean;
  topics: MatchTestTopic[];
}

export interface XTrendOpportunity {
  topic_id?: string | null;
  external_id: string;
  name: string;
  description?: string | null;
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  net_sentiment: number;
  volume: number;
  volume_change_pct?: number | null;
  is_spike: boolean;
  recommendation: PublishingRecommendation;
  recommendation_reason: string;
  can_jump_on_trend: boolean;
  trend_angle: string;
  top_posts: ListeningPost[];
}
