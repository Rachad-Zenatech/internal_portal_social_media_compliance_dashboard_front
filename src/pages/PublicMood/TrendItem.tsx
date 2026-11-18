import { useState } from "react";
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

export function SentimentBar({
  positivePct,
  neutralPct,
  negativePct,
}: {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}) {
  return (
    <div
      className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${positivePct}% positive, ${neutralPct}% neutral, ${negativePct}% negative`}
    >
      <span className="bg-emerald-500" style={{ width: `${positivePct}%` }} />
      <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${neutralPct}%` }} />
      <span className="bg-red-500" style={{ width: `${negativePct}%` }} />
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
  const rec = REC_BADGE[trend.recommendation];
  const displayName = trend.name.replace(/^around this topic:\s*/i, "");

  return (
    <li className="py-3 first:pt-0 last:pb-0 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground break-words">{displayName}</p>
          {showPostTitle && trend.post_title && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              From today&apos;s post: <span className="font-medium text-foreground/85">{trend.post_title}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="tabular-nums text-[11px]">
            <span className="text-emerald-700 dark:text-emerald-300">{trend.positive_pct}%+</span>{" "}
            <span className="text-red-700 dark:text-red-300">{trend.negative_pct}%−</span>
          </span>
          <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${rec.cls}`} title={trend.recommendation_reason}>
            {rec.label}
          </span>
          {trend.is_spike && <SpikeBadge />}
          {trend.top_posts.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-expanded={open}
              title={open ? "Hide scraped articles & posts" : "Show scraped articles & posts"}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <SentimentBar positivePct={trend.positive_pct} neutralPct={trend.neutral_pct} negativePct={trend.negative_pct} />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {compact.format(trend.volume)} items · {trend.trend_angle}
      </p>

      <SearchDetails trend={trend} />

      {open && trend.top_posts.length > 0 && (
        <ul className="mt-2.5 ml-1 space-y-2">
          {trend.top_posts.map((p, idx) => (
            <ScrapedArticleRow key={idx} post={p} />
          ))}
        </ul>
      )}
    </li>
  );
}
