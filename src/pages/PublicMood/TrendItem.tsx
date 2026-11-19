import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";

import { SpikeBadge } from "@/components/submissions/MoodVisuals";
import { REC_BADGE } from "@/components/submissions/TopicTrend";
import type { ListeningPost, XTrendOpportunity } from "@/types/publicMood";
import SearchDetails from "./SearchDetails";

export const TODAY_REASON_LABEL: Record<string, string> = {
  scheduled_today: "Scheduled today",
  today_activity: "Active today",
};

const POST_TONE: Record<string, string> = {
  POSITIVE: "border-emerald-500/60",
  NEUTRAL: "border-border",
  NEGATIVE: "border-red-500/60",
};

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export type SentimentFilter = "ALL" | "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export function SentimentBar({
  positivePct,
  neutralPct,
  negativePct,
  onSelectSentiment,
}: {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  onSelectSentiment?: (sentiment: SentimentFilter) => void;
}) {
  return (
    <div
      className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted cursor-pointer"
      role="img"
      aria-label={`${positivePct}% positive, ${neutralPct}% neutral, ${negativePct}% negative`}
      title="Click any segment to filter scraped posts"
    >
      <span
        className="bg-emerald-500 transition-opacity hover:opacity-80"
        style={{ width: `${positivePct}%` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSentiment?.("POSITIVE");
        }}
        title={`Positive: ${positivePct}% (click to filter)`}
      />
      <span
        className="bg-slate-300 transition-opacity hover:opacity-80 dark:bg-slate-600"
        style={{ width: `${neutralPct}%` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSentiment?.("NEUTRAL");
        }}
        title={`Neutral: ${neutralPct}% (click to filter)`}
      />
      <span
        className="bg-red-500 transition-opacity hover:opacity-80"
        style={{ width: `${negativePct}%` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSentiment?.("NEGATIVE");
        }}
        title={`Negative: ${negativePct}% (click to filter)`}
      />
    </div>
  );
}

function SentimentFilterPills({
  active,
  total,
  positiveCount,
  neutralCount,
  negativeCount,
  onChange,
}: {
  active: SentimentFilter;
  total: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  onChange: (filter: SentimentFilter) => void;
}) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]" role="tablist" aria-label="Filter scraped items by sentiment">
      <button
        type="button"
        onClick={() => onChange("ALL")}
        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
          active === "ALL"
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        All ({total})
      </button>
      <button
        type="button"
        onClick={() => onChange("POSITIVE")}
        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
          active === "POSITIVE"
            ? "bg-emerald-600 text-white dark:bg-emerald-500"
            : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
        }`}
      >
        Positive ({positiveCount})
      </button>
      <button
        type="button"
        onClick={() => onChange("NEUTRAL")}
        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
          active === "NEUTRAL"
            ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900"
            : "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20 dark:text-slate-300"
        }`}
      >
        Neutral ({neutralCount})
      </button>
      <button
        type="button"
        onClick={() => onChange("NEGATIVE")}
        className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
          active === "NEGATIVE"
            ? "bg-red-600 text-white dark:bg-red-500"
            : "bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300"
        }`}
      >
        Negative ({negativeCount})
      </button>
    </div>
  );
}

function ScrapedArticleRow({ post }: { post: ListeningPost }) {
  return (
    <li className={`border-l-2 pl-2.5 ${POST_TONE[post.sentiment] ?? POST_TONE.NEUTRAL}`}>
      <p className="text-foreground/90">
        {post.url ? (
          <a href={post.url} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1 hover:underline">
            <span>{post.text}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
          </a>
        ) : (
          post.text
        )}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {post.network} · {post.author} · {post.sentiment}
        {post.confidence != null ? ` (${post.confidence}%)` : ""}
        {post.posted_on ? ` · ${post.posted_on}` : ""}
      </p>
    </li>
  );
}

function ScrapedArticlesList({
  open,
  posts,
  activeFilter,
  total,
  positiveCount,
  neutralCount,
  negativeCount,
  onFilterChange,
}: {
  open: boolean;
  posts: ListeningPost[];
  activeFilter: SentimentFilter;
  total: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  onFilterChange: (filter: SentimentFilter) => void;
}) {
  if (!open || total === 0) return null;
  return (
    <div className="mt-2.5">
      <SentimentFilterPills
        active={activeFilter}
        total={total}
        positiveCount={positiveCount}
        neutralCount={neutralCount}
        negativeCount={negativeCount}
        onChange={onFilterChange}
      />
      {posts.length === 0 ? (
        <p className="mt-2.5 ml-1 text-[11px] italic text-muted-foreground">
          No {activeFilter.toLowerCase()} items found in this sample.
        </p>
      ) : (
        <ul className="mt-2.5 ml-1 space-y-2">
          {posts.map((p, idx) => (
            <ScrapedArticleRow key={idx} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrendItemHeader({
  displayName,
  showPostTitle,
  postTitle,
  positivePct,
  negativePct,
  rec,
  isSpike,
  hasTopPosts,
  open,
  onToggleOpen,
  onSelectFilter,
}: {
  displayName: string;
  showPostTitle: boolean;
  postTitle?: string | null;
  positivePct: number;
  negativePct: number;
  rec: (typeof REC_BADGE)[keyof typeof REC_BADGE];
  isSpike: boolean;
  hasTopPosts: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onSelectFilter: (filter: SentimentFilter) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground break-words">{displayName}</p>
        {showPostTitle && postTitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            From today&apos;s post: <span className="font-medium text-foreground/85">{postTitle}</span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="tabular-nums text-[11px]">
          <button
            type="button"
            onClick={() => onSelectFilter("POSITIVE")}
            className="text-emerald-700 hover:underline dark:text-emerald-300"
            title="Filter by positive items"
          >
            {positivePct}%+
          </button>{" "}
          <button
            type="button"
            onClick={() => onSelectFilter("NEGATIVE")}
            className="text-red-700 hover:underline dark:text-red-300"
            title="Filter by negative items"
          >
            {negativePct}%−
          </button>
        </span>
        <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${rec.cls}`}>
          {rec.label}
        </span>
        {isSpike && <SpikeBadge />}
        {hasTopPosts && (
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-expanded={open}
            title={open ? "Hide scraped articles & posts" : "Show scraped articles & posts"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}

/** One scraped public-mood topic row with expandable supporting headlines/articles. */
export default function TrendItem({
  trend,
  defaultOpen = false,
  showPostTitle = true,
}: {
  trend: XTrendOpportunity;
  defaultOpen?: boolean;
  showPostTitle?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("ALL");
  const rec = REC_BADGE[trend.recommendation];
  const displayName = trend.name.replace(/^around this topic:\s*/i, "");

  const positiveCount = useMemo(
    () => trend.top_posts.filter((p) => p.sentiment === "POSITIVE").length,
    [trend.top_posts]
  );
  const neutralCount = useMemo(
    () => trend.top_posts.filter((p) => p.sentiment === "NEUTRAL").length,
    [trend.top_posts]
  );
  const negativeCount = useMemo(
    () => trend.top_posts.filter((p) => p.sentiment === "NEGATIVE").length,
    [trend.top_posts]
  );

  const filteredPosts = useMemo(() => {
    if (sentimentFilter === "ALL") return trend.top_posts;
    return trend.top_posts.filter((p) => p.sentiment === sentimentFilter);
  }, [trend.top_posts, sentimentFilter]);

  const handleSelectFilter = (filter: SentimentFilter) => {
    setSentimentFilter(filter);
    setOpen(true);
  };

  return (
    <li className="py-3 first:pt-0 last:pb-0 text-xs">
      <TrendItemHeader
        displayName={displayName}
        showPostTitle={showPostTitle}
        postTitle={trend.post_title}
        positivePct={trend.positive_pct}
        negativePct={trend.negative_pct}
        rec={rec}
        isSpike={trend.is_spike}
        hasTopPosts={trend.top_posts.length > 0}
        open={open}
        onToggleOpen={() => setOpen((v) => !v)}
        onSelectFilter={handleSelectFilter}
      />
      <SentimentBar
        positivePct={trend.positive_pct}
        neutralPct={trend.neutral_pct}
        negativePct={trend.negative_pct}
        onSelectSentiment={handleSelectFilter}
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {compact.format(trend.volume)} items · {trend.trend_angle}
      </p>

      <SearchDetails trend={trend} />

      <ScrapedArticlesList
        open={open}
        posts={filteredPosts}
        activeFilter={sentimentFilter}
        total={trend.top_posts.length}
        positiveCount={positiveCount}
        neutralCount={neutralCount}
        negativeCount={negativeCount}
        onFilterChange={setSentimentFilter}
      />
    </li>
  );
}
