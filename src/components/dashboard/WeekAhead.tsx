import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";

import { Loading, STATUS_PILL, Section, UPCOMING_DAYS, statusOf, viewAll } from "@/components/dashboard/dashboardParts";
import type { SubmissionSummary } from "@/types/submission";

/** The next week as a strip of days; the list below shows one day at a time, today first. Shared by both dashboards. */
export default function WeekAhead({
  posts,
  loading,
  title = "Scheduled Posts",
  subtitle = `What goes out over the next ${UPCOMING_DAYS} days. Pick a day to see its posts.`,
}: {
  posts: SubmissionSummary[];
  loading: boolean;
  title?: string;
  subtitle?: string;
}) {
  const week = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: UPCOMING_DAYS }, (_, i) => {
      const day = addDays(start, i);
      const dayPosts = posts
        .filter((s) => s.publish_at && s.status !== "REJECTED" && isSameDay(new Date(s.publish_at), day))
        .sort((a, b) => new Date(a.publish_at!).getTime() - new Date(b.publish_at!).getTime());
      return { day, posts: dayPosts };
    });
  }, [posts]);
  // One day at a time: today until they pick another.
  const [pickedDay, setPickedDay] = useState(() => startOfDay(new Date()));
  const shownPosts = week.find((d) => isSameDay(d.day, pickedDay))?.posts ?? [];
  const isPicked = (day: Date) => isSameDay(pickedDay, day);
  const dayName = isToday(pickedDay) ? "today" : isTomorrow(pickedDay) ? "tomorrow" : format(pickedDay, "EEEE, MMM d");

  return (
    <Section title={title} subtitle={subtitle} action={viewAll("/content-calendar", "Open calendar")}>
      <div className="grid grid-cols-7 gap-1 border-t border-border/60 px-3 pt-3">
        {week.map(({ day, posts: dayPosts }) => (
          <button
            type="button"
            key={day.toISOString()}
            onClick={() => setPickedDay(day)}
            aria-pressed={isPicked(day)}
            title={dayPosts.length ? dayPosts.map((p) => p.title).join("\n") : "Nothing planned"}
            className={`cursor-pointer rounded-lg px-1 py-2 text-center transition-colors ${
              isPicked(day)
                ? "bg-blue-700 text-white ring-1 ring-blue-700 [&_p]:text-white"
                : isToday(day)
                ? "bg-blue-50 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/30 dark:hover:bg-blue-500/20"
                : "hover:bg-muted"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{format(day, "d")}</p>
            <div className="mt-1 flex min-h-2 justify-center gap-0.5">
              {dayPosts.slice(0, 3).map((p) => (
                <span
                  key={p.id}
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPicked(day) ? "bg-white" : statusOf(p) === "SCHEDULED" ? "bg-violet-500" : "bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
      <p className="px-4 pt-3 text-xs font-semibold text-foreground">
        {isToday(pickedDay) ? `Today, ${format(pickedDay, "MMM d")}` : format(pickedDay, "EEEE, MMM d")}
      </p>
      {loading ? (
        <Loading />
      ) : shownPosts.length === 0 ? (
        <p className="px-4 py-5 text-center text-xs text-muted-foreground">
          Nothing scheduled for {dayName}.
        </p>
      ) : (
        <ul className="grid gap-1.5 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {shownPosts.map((p) => {
            const at = new Date(p.publish_at!);
            const status = STATUS_PILL[statusOf(p)] ?? { label: p.status, pill: "bg-muted text-muted-foreground" };
            return (
              <li key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="w-16 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">{format(at, "h:mm a")}</span>
                <Link to={`/submissions/${p.id}`} className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:underline">
                  {p.title}
                </Link>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.pill}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
