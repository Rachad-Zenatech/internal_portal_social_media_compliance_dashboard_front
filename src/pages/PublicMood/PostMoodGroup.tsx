import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronDown, ExternalLink } from "lucide-react";

import { REC_BADGE } from "@/components/submissions/TopicTrend";
import { summarizePostTrends, type PostGroupData } from "./postMoodGroups";
import TrendItem, { SentimentBar, TODAY_REASON_LABEL } from "./TrendItem";

function PostMoodBody({ group }: { group: PostGroupData }) {
  if (group.trends.length === 0) {
    return (
      <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        {group.has_searches === false
          ? "This post has no named company, product, or campaign keywords yet to search public news."
          : "No scraped public mood results saved for this post yet. Click Scrape today's posts to collect coverage."}
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-border/70 border-t border-border/60 pt-3">
      {group.trends.map((trend) => (
        <TrendItem key={trend.external_id} trend={trend} defaultOpen showPostTitle={false} />
      ))}
    </ul>
  );
}

/** Collapsible per-post section inside Today's Posts so reviewers inspect one post at a time. */
export default function PostMoodGroup({ group, defaultOpen = false }: { group: PostGroupData; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const summary = summarizePostTrends(group.trends);
  const rec = REC_BADGE[summary.recommendation];
  const timeLabel = group.publish_at ? format(new Date(group.publish_at), "h:mm a") : null;
  const reasonLabel = group.today_reason ? (TODAY_REASON_LABEL[group.today_reason] ?? "Today") : null;
  const countLabel =
    group.trends.length > 0
      ? `${group.trends.length} ${group.trends.length === 1 ? "topic" : "topics"} · ${summary.total_volume} items`
      : group.has_searches === false
        ? "No searchable keywords yet"
        : "Waiting for today's scrape";

  return (
    <div className="rounded-xl border border-border/80 bg-muted/15 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-xs text-foreground break-words">{group.title}</span>
              {reasonLabel && (
                <span className="rounded bg-sky-500/10 px-1.5 py-px text-[10px] font-medium text-sky-800 dark:text-sky-200">
                  {reasonLabel}{timeLabel ? ` · ${timeLabel}` : ""}
                </span>
              )}
              {group.status && <span className="text-[10px] uppercase text-muted-foreground">{group.status.replace(/_/g, " ")}</span>}
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{countLabel}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {group.trends.length > 0 && (
            <>
              <span className="tabular-nums text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-300">{summary.positive_pct}%+</span>{" "}
                <span className="text-red-700 dark:text-red-300">{summary.negative_pct}%−</span>
              </span>
              <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${rec.cls}`}>{rec.label}</span>
            </>
          )}
          {group.id && (
            <Link to={`/submissions/new?id=${group.id}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Open post" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {group.trends.length > 0 && <SentimentBar positivePct={summary.positive_pct} neutralPct={summary.neutral_pct} negativePct={summary.negative_pct} />}
      {open && <PostMoodBody group={group} />}
    </div>
  );
}
