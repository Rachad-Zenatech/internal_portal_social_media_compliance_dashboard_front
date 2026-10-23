import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  FlaskConical,
  RotateCcw,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import DemoPoster from "@/components/video/DemoPoster";
import { CoverThumb } from "@/components/submissions/PostPreview";
import { MODE_LABELS, clearPublished, fromSubmission, publishInfo, publishKey, sampleItems, usePublished } from "@/lib/contentCalendar";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { CalendarItem, PublishRecord } from "@/types/calendar";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

type ItemState = "READY" | "PARTIAL" | "DONE";

function stateOf(item: CalendarItem, published: Record<string, PublishRecord>): ItemState {
  const done = item.platforms.filter((p) => published[publishKey(item.id, p)]).length;
  return done === 0 ? "READY" : done === item.platforms.length ? "DONE" : "PARTIAL";
}

const STATE_STYLE: Record<ItemState, { chip: string; label: string; dot: string }> = {
  READY: { chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200", label: "Ready to publish", dot: "bg-emerald-500" },
  PARTIAL: { chip: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200", label: "Partly published", dot: "bg-amber-500" },
  DONE: { chip: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200", label: "Drafts created", dot: "bg-blue-500" },
};

function Thumb({ item, className = "" }: { item: CalendarItem; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
      {item.media ? (
        <CoverThumb cover={item.media} contentType={item.contentType} caption={item.caption} showPlay={false} />
      ) : (
        <DemoPoster variant={item.poster ?? "dusk"} className="w-full h-full" />
      )}
    </div>
  );
}

function AgendaItem({
  item,
  published,
  overdue,
  highlighted,
}: {
  item: CalendarItem;
  published: Record<string, PublishRecord>;
  overdue: boolean;
  highlighted: boolean;
}) {
  const navigate = useNavigate();
  const state = stateOf(item, published);
  return (
    <div
      className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
        highlighted
          ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30 dark:border-blue-500/70 dark:bg-blue-500/10"
          : overdue
          ? "border-red-300 dark:border-red-500/40"
          : "border-border/70 bg-card"
      }`}
    >
      <div className="flex gap-3">
        <Thumb item={item} className="w-20 aspect-video shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{item.title}</p>
          <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-1.5">
            <span className="font-mono">{item.referenceCode}</span>
            <span>· {format(new Date(item.publishAt), "h:mm a")}</span>
            {item.score != null && <span>· Check {item.score}/100</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] min-w-0">
            {item.platforms.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 font-medium">
                <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5 shrink-0" />
                {platformName(p)}
              </span>
            ))}
            {item.account?.is_ceo && (
              <span title="Shaun's channel" aria-label="Shaun's channel">
                <Crown className="w-3 h-3 text-amber-600 shrink-0" />
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${STATE_STYLE[state].chip}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATE_STYLE[state].dot}`} /> {STATE_STYLE[state].label}
        </span>
        {overdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
            <AlertTriangle className="w-3 h-3" /> Past its publish time
          </span>
        )}
        {item.approvedBy && <span className="text-muted-foreground">Approved · {item.approvedBy}</span>}
        {item.source === "sample" && <span className="rounded bg-muted px-1.5 py-px text-muted-foreground">Sample</span>}
      </div>

      <div className="divide-y divide-border/60 rounded-lg border border-border/60">
        {item.platforms.map((p) => {
          const record = published[publishKey(item.id, p)];
          const info = publishInfo(p);
          return (
            <div key={p} className="flex items-center gap-2 px-2.5 py-1.5">
              <PlatformIcon platform={p as SocialPlatform} className="w-4 h-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{platformName(p)}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {record
                    ? `${MODE_LABELS[record.mode]} created ${format(new Date(record.at), "MMM d, h:mm a")}`
                    : `Creates: ${MODE_LABELS[info.mode].toLowerCase()}`}
                </p>
              </div>
              {record ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] gap-1 text-blue-700 dark:text-blue-300"
                  onClick={() => navigate(`/content-calendar/publish/${item.id}/${p}`)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> View
                </Button>
              ) : (
                <Button size="sm" className="h-7 px-2.5 text-[11px] gap-1 bg-blue-700 hover:bg-blue-800 text-white" onClick={() => navigate(`/content-calendar/publish/${item.id}/${p}`)}>
                  <Send className="w-3.5 h-3.5" /> Publish
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ContentCalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const published = usePublished();

  // Approved content is company-wide for people who can see everyone's content; otherwise their own.
  const { hasPermission } = useAuth();
  const scope = hasPermission("CONTENT_SUBMISSIONS_VIEW") ? "all" : "mine";
  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    staleTime: 0,
  });

  const items = useMemo(() => {
    const real = submissions.map(fromSubmission).filter((i): i is CalendarItem => Boolean(i));
    return [...real, ...sampleItems()].sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  }, [submissions]);
  const visible = useMemo(() => (platform === "all" ? items : items.filter((i) => i.platforms.includes(platform))), [items, platform]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month]
  );
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of visible) {
      const key = format(new Date(item.publishAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [visible]);

  const now = new Date();
  const isOverdue = (item: CalendarItem) => isBefore(new Date(item.publishAt), now) && stateOf(item, published) !== "DONE";
  const inMonth = visible.filter((i) => isSameMonth(new Date(i.publishAt), month));
  const stats = {
    approved: inMonth.length,
    ready: inMonth.filter((i) => stateOf(i, published) !== "DONE").length,
    drafted: inMonth.reduce((n, i) => n + i.platforms.filter((p) => published[publishKey(i.id, p)]).length, 0),
    overdue: visible.filter(isOverdue).length,
  };
  const platforms = useMemo(() => [...new Set(items.flatMap((i) => i.platforms))], [items]);

  const selected = byDay.get(format(selectedDay, "yyyy-MM-dd")) ?? [];
  const upcoming = visible.filter((i) => !isBefore(new Date(i.publishAt), now) && stateOf(i, published) !== "DONE").slice(0, 3);
  const hasSamples = items.some((i) => i.source === "sample");

  const agendaRef = useRef<HTMLDivElement | null>(null);
  const selectDay = (day: Date, itemId: string | null = null) => {
    setSelectedDay(day);
    setHighlightId(itemId);
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
    // Below the `wide` breakpoint the agenda sits under the calendar; bring a clicked post into view.
    if (itemId && !window.matchMedia("(min-width: 1400px)").matches) {
      requestAnimationFrame(() => agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Content Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved content by publish date. Publish creates a draft on each platform, so the post gets a final look before it goes live.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasSamples && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <FlaskConical className="w-3.5 h-3.5" /> Sample data · publishing is simulated
            </span>
          )}
          {Object.keys(published).length > 0 && (
            <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 font-semibold" onClick={clearPublished} title="Clear simulated publishes">
              <RotateCcw className="w-3.5 h-3.5" /> Reset demo
            </Button>
          )}
        </div>
      </header>

      {/* Month at a glance: one bar, like the Content Portal's status counts */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 lg:grid-cols-4">
        {[
          { label: "Approved this month", value: stats.approved, icon: CalendarDays, alert: false },
          { label: "Waiting to publish", value: stats.ready, icon: Send, alert: false },
          { label: "Drafts created", value: stats.drafted, icon: CalendarCheck2, alert: false },
          { label: "Past publish time", value: stats.overdue, icon: AlertTriangle, alert: stats.overdue > 0 },
        ].map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className={`flex items-center gap-3 px-4 py-3.5 ${alert ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "bg-card text-muted-foreground"}`}
          >
            <span className={`text-2xl font-semibold tabular-nums ${alert ? "" : "text-foreground"}`}>{value}</span>
            <span className={`text-xs ${alert ? "font-semibold" : ""}`}>{label}</span>
            <Icon className="ml-auto w-4 h-4 opacity-60" />
          </div>
        ))}
      </div>

      {/* The agenda only sits beside the calendar on wide screens; on laptops it goes underneath so the month keeps its width. */}
      <div className="grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <Card className="min-w-0 py-0 gap-0 border-border/70 shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-3 sm:px-4 py-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="min-w-[130px] text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</h2>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs ml-1" onClick={() => selectDay(new Date())}>
                Today
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {["all", ...platforms].map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={platform === p}
                  title={p === "all" ? "All platforms" : platformName(p)}
                  onClick={() => setPlatform(p)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                    platform === p ? "border-blue-700 bg-blue-700 text-white" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "all" ? "All" : <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border/60 bg-muted/30 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>
          {/* minmax(0,1fr) keeps all seven days the same width however long the post titles are. */}
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = byDay.get(key) ?? [];
              const isSelected = isSameDay(day, selectedDay);
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${format(day, "EEEE, MMMM d")}: ${dayItems.length} post${dayItems.length === 1 ? "" : "s"}`}
                  onClick={() => selectDay(day)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectDay(day);
                    }
                  }}
                  className={`min-w-0 min-h-[64px] sm:min-h-[112px] border-b border-r border-border/50 p-1 sm:p-1.5 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    isSelected ? "bg-blue-50/70 dark:bg-blue-500/10" : "hover:bg-muted/40"
                  } ${isSameMonth(day, month) ? "" : "bg-muted/20 text-muted-foreground/60"}`}
                >
                  <span
                    className={`inline-grid place-items-center w-6 h-6 rounded-full text-[11px] font-semibold ${
                      isToday(day) ? "bg-blue-700 text-white" : isSelected ? "ring-1 ring-blue-600 text-blue-700 dark:text-blue-300" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Phones: dots. Larger screens: one chip per post. */}
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {dayItems.map((i) => (
                      <span key={i.id} className={`w-1.5 h-1.5 rounded-full ${isOverdue(i) ? "bg-red-500" : STATE_STYLE[stateOf(i, published)].dot}`} />
                    ))}
                  </div>
                  <div className="mt-1 hidden sm:flex flex-col gap-1">
                    {dayItems.slice(0, 3).map((i) => {
                      const st = stateOf(i, published);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectDay(day, i.id);
                          }}
                          className={`w-full min-w-0 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight transition-shadow hover:shadow-sm ${STATE_STYLE[st].chip} ${
                            isOverdue(i) ? "border-red-500/60" : ""
                          }`}
                          title={`${i.title} · ${format(new Date(i.publishAt), "h:mm a")} · ${i.platforms.map(platformName).join(", ")} · ${STATE_STYLE[st].label}`}
                        >
                          <span className="flex items-center gap-1 min-w-0">
                            {i.platforms.slice(0, 2).map((p) => (
                              <PlatformIcon key={p} platform={p as SocialPlatform} className="w-3 h-3 shrink-0" />
                            ))}
                            {i.platforms.length > 2 && <span className="shrink-0 font-semibold opacity-70">+{i.platforms.length - 2}</span>}
                            <span className="ml-auto hidden tablet:inline shrink-0 tabular-nums opacity-70">
                              {format(new Date(i.publishAt), "h:mma").toLowerCase()}
                            </span>
                          </span>
                          <span className="block truncate font-semibold">{i.title}</span>
                        </button>
                      );
                    })}
                    {dayItems.length > 3 && <span className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 px-4 py-2.5 text-[11px] text-muted-foreground">
            {(Object.keys(STATE_STYLE) as ItemState[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${STATE_STYLE[s].dot}`} /> {STATE_STYLE[s].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Past its publish time
            </span>
          </div>
        </Card>

        <Card ref={agendaRef} className="min-w-0 scroll-mt-4 py-0 gap-0 border-border/70 shadow-xs wide:sticky wide:top-4">
          <div className="border-b border-border/70 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <CalendarDays className="w-3.5 h-3.5" /> Day agenda
            </p>
            <p className="mt-1 text-base font-semibold">{format(selectedDay, "EEEE, MMMM d")}</p>
            <p className="text-[11px] text-muted-foreground">
              {selected.length ? `${selected.length} approved post${selected.length === 1 ? "" : "s"}` : "Nothing scheduled"}
            </p>
          </div>
          {/* Under the calendar there's room for two posts side by side; beside it, one column that scrolls. */}
          <div className="p-3 grid gap-3 tablet:grid-cols-2 wide:grid-cols-1 items-start wide:max-h-[calc(100vh-220px)] wide:overflow-y-auto">
            {selected.map((item) => (
              <AgendaItem key={item.id} item={item} published={published} overdue={isOverdue(item)} highlighted={item.id === highlightId} />
            ))}
            {selected.length === 0 && upcoming.length > 0 && (
              <div className="space-y-2 tablet:col-span-2 wide:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Next up</p>
                {upcoming.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => selectDay(new Date(i.publishAt), i.id)}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border/70 p-2 text-left hover:border-blue-300 hover:shadow-sm"
                  >
                    <Thumb item={i} className="w-14 aspect-video shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold truncate">{i.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{format(new Date(i.publishAt), "EEE MMM d, h:mm a")}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
