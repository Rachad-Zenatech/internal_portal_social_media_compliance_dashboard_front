/** Public mood: how people online currently feel about the topics a post touches (social listening). */

export interface ListeningPost {
  network: string;
  author: string;
  text: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
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
  snapshot?: TopicSnapshot | null;
}

export type PublicMoodOverall = "FAVOURABLE" | "MIXED" | "UNFAVOURABLE" | "NO_DATA";

export interface PublicMoodResult {
  overall: PublicMoodOverall;
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
