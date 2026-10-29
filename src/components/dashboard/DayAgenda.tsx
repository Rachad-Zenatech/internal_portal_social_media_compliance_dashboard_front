import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, isSameDay, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { Loading, STATUS_PILL, Section, Thumb, statusOf, viewAll } from "@/components/dashboard/dashboardParts";
import type { SubmissionSummary } from "@/types/submission";

const dayName = (d: Date) =>
  isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : isYesterday(d) ? "Yesterday" : format(d, "EEEE");

/** One day of posts at a time, in time order, with arrows to step through days. Busy days scroll inside the card. */
export default function DayAgenda({
  posts,
  loading,
  title = "Coming up",
}: {
  posts: SubmissionSummary[];
  loading: boolean;
  title?: string;
}) {
  const [day, setDay] = useState(() => startOfDay(new Date()));

  const dated = useMemo(
    () =>
      posts
        .filter((s) => s.publish_at && s.status !== "REJECTED")
        .map((s) => ({ s, at: new Date(s.publish_at!) }))
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    [posts]
  );
  const shown = dated.filter((p) => isSameDay(p.at, day));
  // When the day is empty, offer a jump to the next day that has something.
  const next = shown.length ? null : dated.find((p) => p.at >= addDays(day, 1));

  return (
    <Section
      title={title}
      subtitle={loading ? undefined : shown.length ? `${shown.length} post${shown.length === 1 ? "" : "s"} on this day` : "Nothing on this day"}
      action={
        <div className="flex shrink-0 items-center gap-2">
          {!isToday(day) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDay(startOfDay(new Date()))}>
              Today
            </Button>
          )}
          {viewAll("/content-calendar", "Open calendar")}
        </div>
      }
    >
      <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <p className="text-sm font-semibold text-foreground">{dayName(day)}</p>
          <p className="text-xs text-muted-foreground">{format(day, "EEE, MMM d, yyyy")}</p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Next day" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <div className="border-t border-border/60 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing scheduled for {isToday(day) || isTomorrow(day) || isYesterday(day) ? dayName(day).toLowerCase() : format(day, "EEEE, MMM d")}.
          </p>
          {next && (
            <Button variant="outline" size="sm" className="mt-3 h-8 max-w-full gap-1 text-xs" onClick={() => setDay(startOfDay(next.at))}>
              <span className="truncate">
                Next: {format(next.at, "EEE, MMM d")} · {next.s.title}
              </span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </Button>
          )}
        </div>
      ) : (
        <ul className="max-h-[360px] divide-y divide-border/60 overflow-y-auto border-t border-border/60">
          {shown.map(({ s, at }) => {
            const status = STATUS_PILL[statusOf(s)] ?? { label: s.status, pill: "bg-muted text-muted-foreground" };
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-foreground">{format(at, "h:mm a")}</span>
                <Thumb s={s} className="h-9 w-12" />
                <div className="min-w-0 flex-1">
                  <Link to={`/submissions/${s.id}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                    {s.title}
                  </Link>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.platforms.slice(0, 3).map((p) => (
                      <PlatformIcon key={p} platform={p as SocialPlatform} className="w-3 h-3" />
                    ))}
                    <span className="truncate">
                      {s.platforms.map((p) => PLATFORM_LABELS[p as SocialPlatform] ?? p).join(", ") || "No platform set"}
                    </span>
                  </span>
                </div>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${status.pill}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
