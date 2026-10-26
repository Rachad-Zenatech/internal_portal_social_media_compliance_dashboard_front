/** Post performance: how live posts are doing on each platform, and whether the reaction is still positive. */

export type PostHealth = "HEALTHY" | "WATCH" | "AT_RISK";

export interface CommentSample {
  author: string;
  text: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  likes: number;
  posted_at?: string | null;
}

/** A metric a platform's API can report for a post. */
export type PostMetric =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "clicks"
  | "quotes"
  | "dislikes"
  | "negative_reactions"
  | "avg_watch_seconds";

/** What one platform's API can give us for a post, and what it takes. */
export interface PlatformApi {
  key: string;
  name: string;
  api?: string | null;
  metrics: PostMetric[];
  /** The platform's own name for a metric, where it differs (e.g. "Impressions"). */
  labels: Partial<Record<PostMetric, string>>;
  /** The comments themselves can be read, so their sentiment can be judged. */
  comment_text: boolean;
  negative_signal?: string | null;
  access: string;
}

export interface PerformancePost {
  /** Post plus platform: one row per post per platform. */
  key: string;
  submission_id?: string | null;
  reference_code?: string | null;
  title: string;
  brand_code?: string | null;
  brand_name?: string | null;
  platform: string;
  /** Which platform API the numbers come from (a personal LinkedIn profile uses a different one than a page). */
  api: string;
  platform_name: string;
  published_at: string;
  creator_name?: string | null;
  /** An example post shown while there's no real data, not one of ours. */
  is_sample: boolean;
  /** The metrics this platform provides, and its names for them. Anything else is null, not zero. */
  available: PostMetric[];
  labels: Partial<Record<PostMetric, string>>;
  comment_text: boolean;
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  clicks?: number | null;
  quotes?: number | null;
  dislikes?: number | null;
  negative_reactions?: number | null;
  avg_watch_seconds?: number | null;
  engagements: number;
  /** Engagements / views, and likes / views (0-1); null where the platform reports no views. */
  engagement_rate?: number | null;
  like_rate?: number | null;
  sentiment?: { positive: number; neutral: number; negative: number } | null;
  /** Change in the share of negative comments since the previous check, in percentage points. */
  negative_change?: number | null;
  health: PostHealth;
  reasons: string[];
  /** What the health is based on ("comments", "dislikes", "downvotes", "reactions"); empty when the platform gives
   * no sentiment signal, so only the like rate is checked. */
  sentiment_basis: string[];
  daily_views: number[];
  comment_samples: CommentSample[];
  fetched_at?: string | null;
}

export interface PerformanceSummary {
  posts: number;
  views: number;
  engagements: number;
  engagement_rate: number;
  positive_pct?: number | null;
  negative_pct?: number | null;
  healthy: number;
  watch: number;
  at_risk: number;
}

export interface PerformanceReport {
  source: string;
  is_mock: boolean;
  message?: string | null;
  /** The viewer sees the whole team's posts (reviewers, managers) rather than only their own. */
  team_view: boolean;
  summary: PerformanceSummary;
  posts: PerformancePost[];
  /** Posts on platforms with no API for post numbers (e.g. the website), left out of the numbers. */
  unmeasured: number;
  platform_apis: PlatformApi[];
}

export interface PerformanceFilters {
  days: number;
  platform?: string;
  brand?: string;
  /** true: only your posts; false: the whole team's; undefined: the default for your role. */
  mine?: boolean;
}
