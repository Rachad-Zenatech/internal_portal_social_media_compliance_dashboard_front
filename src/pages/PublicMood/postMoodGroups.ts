import type {
  NavScrapeTrack,
  PublishingRecommendation,
  XTrendOpportunity,
} from "@/types/publicMood";

export interface PostGroupData {
  key: string;
  id?: string;
  title: string;
  status?: string;
  today_reason?: string | null;
  publish_at?: string | null;
  has_searches?: boolean;
  trends: XTrendOpportunity[];
}

export interface PostAggregate {
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  total_volume: number;
  recommendation: PublishingRecommendation;
}

const CONTEXT_SUFFIX = /-context-\d+$/;

/** Resolve the owning submission id for a post/context listening topic. */
export function resolvePostId(trend: XTrendOpportunity): string | null {
  if (trend.post_id) return trend.post_id;
  if (!trend.external_id.startsWith("post-")) return null;
  const extracted = trend.external_id.slice(5).replace(CONTEXT_SUFFIX, "");
  return extracted || null;
}

/** Group today's scraped topics into one section per post while preserving post order. */
export function groupTrendsByPost(track: NavScrapeTrack): PostGroupData[] {
  const groups: PostGroupData[] = track.posts.map((post) => ({
    key: post.id,
    id: post.id,
    title: post.title,
    status: post.status,
    today_reason: post.today_reason,
    publish_at: post.publish_at,
    has_searches: post.has_searches,
    trends: [],
  }));

  const byId = new Map<string, PostGroupData>(groups.map((g) => [g.key, g]));
  const byTitle = new Map<string, PostGroupData>(groups.map((g) => [g.title, g]));

  for (const trend of track.trends) {
    const pid = resolvePostId(trend);
    const match =
      (pid ? byId.get(pid) : undefined) ??
      (trend.post_title ? byTitle.get(trend.post_title) : undefined);

    if (match) {
      match.trends.push(trend);
      continue;
    }

    const fallbackKey = pid ?? trend.post_title ?? trend.external_id;
    let extra = byId.get(fallbackKey);
    if (!extra) {
      extra = {
        key: fallbackKey,
        id: pid ?? undefined,
        title: trend.post_title || trend.name,
        today_reason: trend.today_reason,
        publish_at: trend.publish_at,
        has_searches: true,
        trends: [],
      };
      byId.set(fallbackKey, extra);
      groups.push(extra);
    }
    extra.trends.push(trend);
  }

  return groups;
}

/** Volume-weighted sentiment percentages and aggregate recommendation across one post's topics. */
export function summarizePostTrends(trends: XTrendOpportunity[]): PostAggregate {
  const totalVolume = trends.reduce((sum, t) => sum + (t.volume || 0), 0);
  if (trends.length === 0) {
    return {
      positive_pct: 0,
      neutral_pct: 0,
      negative_pct: 0,
      total_volume: 0,
      recommendation: "WAIT",
    };
  }

  const posWeight = trends.reduce((s, t) => s + t.positive_pct * (totalVolume > 0 ? t.volume : 1), 0);
  const negWeight = trends.reduce((s, t) => s + t.negative_pct * (totalVolume > 0 ? t.volume : 1), 0);
  const denom = totalVolume > 0 ? totalVolume : trends.length;

  const positive_pct = Math.round((posWeight / denom) * 10) / 10;
  const negative_pct = Math.round((negWeight / denom) * 10) / 10;
  const neutral_pct = Math.max(0, Math.round((100 - positive_pct - negative_pct) * 10) / 10);

  let recommendation: PublishingRecommendation = "WAIT";
  if (trends.some((t) => t.recommendation === "HOLD")) {
    recommendation = "HOLD";
  } else if (trends.every((t) => t.recommendation === "POST")) {
    recommendation = "POST";
  }

  return { positive_pct, neutral_pct, negative_pct, total_volume: totalVolume, recommendation };
}
