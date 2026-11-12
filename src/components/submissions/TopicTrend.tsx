import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Flame, Globe2, Loader2, RefreshCw, ShieldAlert, TrendingDown, TrendingUp, Undo2, X } from "lucide-react";

import { SpikeBadge } from "@/components/submissions/MoodVisuals";
import { ProcessLog } from "@/components/submissions/ProcessLog";
import { useMarketTrends, useScrapeTwitter } from "@/hooks/usePublicMood";
import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import type { MatchedTopic, PublicMood, PublishingRecommendation, XTrendOpportunity } from "@/types/publicMood";

const POST_TONE: Record<string, string> = {
  POSITIVE: "border-emerald-500/60",
  NEUTRAL: "border-border",
  NEGATIVE: "border-red-500/60",
};

export const REC_BADGE: Record<PublishingRecommendation, { label: string; cls: string }> = {
  POST: {
    label: "POST",
    cls: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30",
  },
  WAIT: {
    label: "WAIT",
    cls: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30",
  },
  HOLD: {
    label: "HOLD",
    cls: "bg-red-500/15 text-red-800 dark:text-red-200 border border-red-500/30",
  },
};

export function overallPostDecision(mood?: PublicMood | null): {
  recommendation: PublishingRecommendation;
  reason: string;
} | null {
  if (!mood || mood.topics.length === 0) return null;
  if (mood.summary?.result.recommendation) {
    return {
      recommendation: mood.summary.result.recommendation,
      reason:
        mood.summary.result.recommendation_reason ||
        mood.summary.result.headline ||
        "Based on live market & news sentiment for the topics in this post.",
    };
  }
  // The wider topic around the post is shown, but only the post's own and company topics decide its recommendation.
  const snaps = mood.topics.filter((t) => t.snapshot && t.kind !== "context").map((t) => ({ name: t.name, s: t.snapshot! }));
  if (snaps.length === 0) return null;
  const holds = snaps.filter((x) => x.s.recommendation === "HOLD");
  if (holds.length > 0) {
    return {
      recommendation: "HOLD",
      reason: `Crisis or negative news on ${holds.map((h) => h.name).join(", ")}. ${holds[0].s.recommendation_reason || "Escalate before publishing."}`,
    };
  }
  const waits = snaps.filter((x) => x.s.recommendation === "WAIT");
  if (waits.length > 0) {
    return {
      recommendation: "WAIT",
      reason: `${waits.map((w) => w.name).join(", ")}: ${waits[0].s.recommendation_reason || "not enough positive evidence yet"}`,
    };
  }
  return {
    recommendation: "POST",
    reason: `Favourable public mood across ${snaps.map((x) => x.name).join(", ")}. Good trend to publish on.`,
  };
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

function TopicRow({ t, onDismiss, busy }: { t: MatchedTopic; onDismiss?: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const s = t.snapshot;
  const how =
    t.kind === "context"
      ? `The wider topic around this post: what the news and public are saying about it`
      : t.matched_by === "MEANING"
      ? "About it without naming it"
      : `Mentions ${t.matched_terms.map((m) => `"${m}"`).join(", ")}`;
  const rec = s?.recommendation ? REC_BADGE[s.recommendation] : null;
  return (
    <li className="py-2 first:pt-0 last:pb-0 text-xs">
      {/* topic above, its mentions under it, the sentiment bar at the bottom */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground break-words" title={t.name}>
            {t.name}
          </p>
          <p className="text-[10px] text-muted-foreground break-words" title={how}>
            {how}
          </p>
        </div>
        {s ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="tabular-nums text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-300">{s.positive_pct}%+</span>{" "}
              <span className="text-red-700 dark:text-red-300">{s.negative_pct}%−</span>
            </span>
            {rec && (
              <span
                className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${rec.cls}`}
                title={s.recommendation_reason || undefined}
              >
                {rec.label}
              </span>
            )}
            {s.volume_change_pct != null && (
              <span className="hidden @sm:inline-flex items-center gap-0.5 tabular-nums text-[11px] text-muted-foreground" title={`${compact.format(s.volume)} mentions, last ${s.window_days} days`}>
                {s.volume_change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {s.volume_change_pct > 0 ? "+" : ""}
                {s.volume_change_pct}%
              </span>
            )}
            {s.is_spike && <SpikeBadge />}
            {s.top_posts.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-expanded={open}
                title={open ? "Hide recent posts about this topic" : "Show recent posts about this topic"}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Not what this post is about: leave this topic out"
                aria-label={`${t.name} isn't what this post is about`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-muted-foreground">No data right now</span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Not what this post is about: leave this topic out"
                aria-label={`${t.name} isn't what this post is about`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
      {s && (
        <div
          className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${s.positive_pct}% positive, ${s.neutral_pct}% neutral, ${s.negative_pct}% negative`}
        >
          <span className="bg-emerald-500" style={{ width: `${s.positive_pct}%` }} />
          <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${s.neutral_pct}%` }} />
          <span className="bg-red-500" style={{ width: `${s.negative_pct}%` }} />
        </div>
      )}
      {open && s && (
        <ul className="mt-2 ml-1 space-y-1.5">
          {s.recommendation_reason && (
            <li className="text-[11px] font-medium text-foreground/90">
              {s.recommendation_reason}
            </li>
          )}
          <li className="text-[10px] text-muted-foreground">
            Recent public posts & headlines mentioning {t.name} (last {s.window_days} days), not comments on this post.
          </li>
          {s.top_posts.map((p, i) => (
            <li key={i} className={`border-l-2 pl-2 ${POST_TONE[p.sentiment]}`}>
              <p className="text-foreground/90">{p.text}</p>
              <p className="text-[10px] text-muted-foreground">
                {p.network} · {p.author} · {p.sentiment}
                {p.confidence != null ? ` (${p.confidence}%)` : ""} · {compact.format(p.engagements)} engagements
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function MarketTrendRow({ t }: { t: XTrendOpportunity }) {
  const [open, setOpen] = useState(false);
  const rec = REC_BADGE[t.recommendation];
  return (
    <li className="py-2 first:pt-0 last:pb-0 text-xs">
      <div className="flex items-center gap-2">
        <div className="min-w-0 w-28 @md:w-36 shrink-0">
          <p className="font-semibold text-foreground truncate" title={t.name}>
            {t.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {t.can_jump_on_trend ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                <Flame className="w-2.5 h-2.5" /> Jump on trend
              </span>
            ) : t.recommendation === "HOLD" ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-red-700 dark:text-red-300">
                <ShieldAlert className="w-2.5 h-2.5" /> Crisis / avoid
              </span>
            ) : (
              <span>Mixed · monitor</span>
            )}
          </p>
        </div>
        <div
          className="flex h-2 flex-1 min-w-12 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${t.positive_pct}% positive, ${t.neutral_pct}% neutral, ${t.negative_pct}% negative`}
        >
          <span className="bg-emerald-500" style={{ width: `${t.positive_pct}%` }} />
          <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${t.neutral_pct}%` }} />
          <span className="bg-red-500" style={{ width: `${t.negative_pct}%` }} />
        </div>
        <span className="shrink-0 tabular-nums text-[11px]">
          <span className="text-emerald-700 dark:text-emerald-300">{t.positive_pct}%+</span>{" "}
          <span className="text-red-700 dark:text-red-300">{t.negative_pct}%−</span>
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${rec.cls}`}
          title={t.recommendation_reason}
        >
          {rec.label}
        </span>
        {t.is_spike && <SpikeBadge />}
        {t.top_posts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-expanded={open}
            title={open ? "Hide scraped news & X posts" : "Show scraped news & X posts"}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-2 ml-1 space-y-1.5">
          <li className="text-[11px] font-medium text-foreground/90">{t.trend_angle}</li>
          {t.top_posts.map((p, i) => (
            <li key={i} className={`border-l-2 pl-2 ${POST_TONE[p.sentiment]}`}>
              <p className="text-foreground/90">{p.text}</p>
              <p className="text-[10px] text-muted-foreground">
                {p.network} · {p.author} · {p.sentiment}
                {p.confidence != null ? ` (${p.confidence}%)` : ""} · {compact.format(p.engagements)} engagements
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * How the topics this post touches are doing online right now (social listening),
 * plus live market & world-news trends so reviewers see both what this post triggers
 * and what is trending across the industry right now.
 */
export default function TopicTrend({
  submissionId,
  mood,
  isLoading,
  canEdit = false,
  busy = false,
  onDismiss,
  onRestore,
}: {
  submissionId?: string | null;
  mood?: PublicMood | null;
  isLoading: boolean;
  /** Can say a topic isn't what the post is about (and put it back). */
  canEdit?: boolean;
  busy?: boolean;
  onDismiss?: (topicId: string) => void;
  onRestore?: (topicId: string) => void;
}) {
  const { data: marketTrends, isLoading: trendsLoading } = useMarketTrends(true);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const scrapeTwitter = useScrapeTwitter(submissionId);
  const { addJob } = useGlobalProgress();

  const handleScrape = () => {
    const promise = scrapeTwitter.mutateAsync();
    addJob("Scrape X (Twitter) & News", promise, {
      description: "Searching news and X from your drafts' content, then re-scoring public mood (a few minutes)...",
      type: "upload",
      link_url: submissionId ? `/submissions/new?id=${submissionId}` : undefined,
    });
  };

  const oldest = mood?.topics
    .map((t) => t.snapshot?.fetched_at)
    .filter(Boolean)
    .sort()
    .at(0);

  const decision = overallPostDecision(mood);
  const matchedIds = new Set<string | null | undefined>((mood?.topics ?? []).map((t) => t.topic_id));
  const otherTrends = (marketTrends ?? []).filter((t) => !matchedIds.has(t.topic_id));

  return (
    <div className="space-y-2.5">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
          <Globe2 className="w-3.5 h-3.5 text-sky-600" /> Public mood & live news sentiment
          {mood?.source && (
            <span className="rounded bg-sky-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              {mood.is_mock ? "Sample data" : mood.source}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {decision && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${REC_BADGE[decision.recommendation].cls}`}
                title={decision.reason}
              >
                Recommend: {decision.recommendation}
              </span>
            )}
            <button
              type="button"
              onClick={handleScrape}
              disabled={scrapeTwitter.isPending}
              title="Scrape public X (Twitter) posts & live market news sentiment now (calls background scraper / API)"
              className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-800 dark:text-sky-200 px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${scrapeTwitter.isPending ? "animate-spin" : ""}`} />
              <span>{scrapeTwitter.isPending ? "Scraping X..." : "Scrape X"}</span>
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Sentiment on scraped news & X posts over the last week
          {oldest ? ` · updated ${formatDistanceToNow(new Date(oldest), { addSuffix: true })}` : ""}
        </p>
      </div>

      {decision && (
        <div
          className={`rounded-lg border px-2.5 py-2 text-xs ${
            decision.recommendation === "HOLD"
              ? "border-red-500/35 bg-red-500/5 text-red-900 dark:text-red-200"
              : decision.recommendation === "WAIT"
              ? "border-amber-500/35 bg-amber-500/5 text-amber-900 dark:text-amber-200"
              : "border-emerald-500/35 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          <span className="font-semibold">{decision.recommendation}:</span> {decision.reason}
        </div>
      )}

      <ProcessLog steps={mood?.process} />

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking which topics this post touches...
        </p>
      ) : !mood ? null : mood.topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {mood.message || "None of the tracked topics come up directly in this post's text or transcript."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70 px-2.5 py-2">
          {mood.topics.map((t) => (
            <TopicRow key={t.topic_id} t={t} busy={busy} onDismiss={canEdit && onDismiss ? () => onDismiss(t.topic_id) : undefined} />
          ))}
        </ul>
      )}

      {mood && mood.dismissed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Left out as not about this post:</span>
          {mood.dismissed.map((d) => (
            <span key={d.topic_id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5" title={d.by_name ? `Left out by ${d.by_name}` : undefined}>
              {d.name}
              {canEdit && onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(d.topic_id)}
                  disabled={busy}
                  className="inline-flex items-center gap-0.5 font-semibold text-foreground/80 hover:text-foreground disabled:opacity-50"
                >
                  <Undo2 className="w-3 h-3" /> Put back
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Live market trends radar (always available so reviewers see what's trending to jump on or avoid) */}
      {(otherTrends.length > 0 || (mood && mood.topics.length === 0 && (marketTrends?.length ?? 0) > 0)) && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAllTrends((v) => !v)}
            className="flex w-full items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-left text-[11px] font-semibold text-foreground/90 hover:bg-muted"
          >
            <span>
              {mood && mood.topics.length === 0
                ? `Live market & news trends right now (${marketTrends?.length ?? 0})`
                : `Other live market trends to jump on or avoid (${otherTrends.length})`}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                showAllTrends || (mood?.topics.length === 0) ? "rotate-180" : ""
              }`}
            />
          </button>
          {(showAllTrends || mood?.topics.length === 0) && (
            trendsLoading ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading market trends...
              </p>
            ) : (
              <ul className="mt-1.5 divide-y divide-border/60 rounded-lg border border-border/70 px-2.5 py-2">
                {(mood?.topics.length === 0 ? marketTrends ?? [] : otherTrends).map((t) => (
                  <MarketTrendRow key={t.topic_id} t={t} />
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
