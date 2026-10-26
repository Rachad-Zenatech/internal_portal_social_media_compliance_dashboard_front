import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Globe2, Loader2, TrendingDown, TrendingUp, Undo2, X } from "lucide-react";

import { SpikeBadge } from "@/components/submissions/MoodVisuals";
import type { MatchedTopic, PublicMood } from "@/types/publicMood";

const POST_TONE: Record<string, string> = {
  POSITIVE: "border-emerald-500/60",
  NEUTRAL: "border-border",
  NEGATIVE: "border-red-500/60",
};

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

function TopicRow({ t, onDismiss, busy }: { t: MatchedTopic; onDismiss?: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const s = t.snapshot;
  const how = t.matched_by === "MEANING" ? "About it without naming it" : `Mentions ${t.matched_terms.map((m) => `"${m}"`).join(", ")}`;
  return (
    <li className="py-2 first:pt-0 last:pb-0 text-xs">
      <div className="flex items-center gap-2">
        <div className="min-w-0 w-28 @md:w-36 shrink-0">
          <p className="font-semibold text-foreground truncate" title={t.name}>
            {t.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate" title={how}>
            {how}
          </p>
        </div>
        {s ? (
          <>
            <div
              className="flex h-2 flex-1 min-w-12 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${s.positive_pct}% positive, ${s.neutral_pct}% neutral, ${s.negative_pct}% negative`}
            >
              <span className="bg-emerald-500" style={{ width: `${s.positive_pct}%` }} />
              <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${s.neutral_pct}%` }} />
              <span className="bg-red-500" style={{ width: `${s.negative_pct}%` }} />
            </div>
            <span className="shrink-0 tabular-nums text-[11px]">
              <span className="text-emerald-700 dark:text-emerald-300">{s.positive_pct}%+</span>{" "}
              <span className="text-red-700 dark:text-red-300">{s.negative_pct}%−</span>
            </span>
            {s.volume_change_pct != null && (
              <span className="hidden @sm:inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-muted-foreground" title={`${compact.format(s.volume)} mentions, last ${s.window_days} days`}>
                {s.volume_change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {s.volume_change_pct > 0 ? "+" : ""}
                {s.volume_change_pct}%
              </span>
            )}
            {s.is_spike && <SpikeBadge />}
          </>
        ) : (
          <span className="flex-1 text-[11px] text-muted-foreground">No data right now</span>
        )}
        {s && s.top_posts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Not what this post is about: leave this topic out"
            aria-label={`${t.name} isn't what this post is about`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && s && (
        <ul className="mt-2 ml-1 space-y-1.5">
          <li className="text-[10px] text-muted-foreground">
            Recent public posts by anyone mentioning {t.name} (last {s.window_days} days), not comments on this post.
          </li>
          {s.top_posts.map((p, i) => (
            <li key={i} className={`border-l-2 pl-2 ${POST_TONE[p.sentiment]}`}>
              <p className="text-foreground/90">{p.text}</p>
              <p className="text-[10px] text-muted-foreground">
                {p.network} · {p.author} · {compact.format(p.engagements)} engagements
              </p>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * How the topics this post touches are doing online right now (social listening; sample data until Sprout is
 * connected). Compact rows: share of positive and negative mentions, the trend, and whether it's spiking.
 */
export default function TopicTrend({
  mood,
  isLoading,
  canEdit,
  busy,
  onDismiss,
  onRestore,
}: {
  mood?: PublicMood | null;
  isLoading: boolean;
  /** Can say a topic isn't what the post is about (and put it back). */
  canEdit: boolean;
  busy: boolean;
  onDismiss: (topicId: string) => void;
  onRestore: (topicId: string) => void;
}) {
  const oldest = mood?.topics
    .map((t) => t.snapshot?.fetched_at)
    .filter(Boolean)
    .sort()
    .at(0);
  return (
    <div className="space-y-2">
      <div>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground">
          <Globe2 className="w-3.5 h-3.5 text-sky-600" /> How its topics are doing online
          {mood?.is_mock && (
            <span className="rounded bg-sky-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              Sample data
            </span>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Share of positive and negative mentions over the last week
          {oldest ? ` · updated ${formatDistanceToNow(new Date(oldest), { addSuffix: true })}` : ""}
          {mood?.is_mock ? " · not real numbers until Sprout Social is connected" : ""}
        </p>
      </div>
      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking which topics this post touches...
        </p>
      ) : !mood ? null : mood.topics.length === 0 ? (
        <p className="text-xs text-muted-foreground">{mood.message || "None of the tracked topics come up in this post."}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70 px-2.5 py-2">
          {mood.topics.map((t) => (
            <TopicRow key={t.topic_id} t={t} busy={busy} onDismiss={canEdit ? () => onDismiss(t.topic_id) : undefined} />
          ))}
        </ul>
      )}
      {mood && mood.dismissed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Left out as not about this post:</span>
          {mood.dismissed.map((d) => (
            <span key={d.topic_id} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5" title={d.by_name ? `Left out by ${d.by_name}` : undefined}>
              {d.name}
              {canEdit && (
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
    </div>
  );
}
