import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Landmark, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NavScrapeTrack, ScrapeScope } from "@/types/publicMood";
import PostMoodGroup from "./PostMoodGroup";
import { groupTrendsByPost } from "./postMoodGroups";
import TrendItem from "./TrendItem";

function TodayPostsTrackContent({ track }: { track: NavScrapeTrack }) {
  const groups = groupTrendsByPost(track);
  if (groups.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
        {track.empty_reason || "No posts scheduled or active today yet."}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2.5">
      {track.trends.length === 0 && track.empty_reason && (
        <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
          {track.empty_reason}
        </p>
      )}
      {groups.map((group) => (
        <PostMoodGroup key={group.key} group={group} />
      ))}
    </div>
  );
}

/** One of the two public scraping sections on the Public mood nav page. */
export default function NavTrackSection({
  track,
  scope,
  scrapeLabel,
  busy,
  activeScope,
  onScrape,
}: {
  track: NavScrapeTrack;
  scope: Exclude<ScrapeScope, "all">;
  scrapeLabel: string;
  busy: boolean;
  activeScope: ScrapeScope | null;
  onScrape: (scope: ScrapeScope) => void;
}) {
  const Icon = track.key === "financial_zenatech" ? Landmark : CalendarClock;
  const scrapingThis = busy && (activeScope === scope || activeScope === "all");

  return (
    <section className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm" aria-label={track.title}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{track.title}</h2>
            <p className="text-xs text-muted-foreground">{track.subtitle}</p>
            {track.collected_at && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Updated {formatDistanceToNow(new Date(track.collected_at), { addSuffix: true })} · Status: {track.status}
              </p>
            )}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => onScrape(scope)}>
          <RefreshCw className={`h-3.5 w-3.5 ${scrapingThis ? "animate-spin" : ""}`} />
          <span>{scrapingThis ? "Scraping..." : scrapeLabel}</span>
        </Button>
      </div>

      {track.key === "today_posts" ? (
        <TodayPostsTrackContent track={track} />
      ) : track.trends.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
          {track.empty_reason || "No scraped items available yet."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/70">
          {track.trends.map((trend) => (
            <TrendItem key={trend.external_id} trend={trend} />
          ))}
        </ul>
      )}
    </section>
  );
}
