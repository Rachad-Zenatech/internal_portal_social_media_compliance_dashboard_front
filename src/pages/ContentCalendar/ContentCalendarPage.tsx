import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Crown, ExternalLink, FlaskConical, Plus, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import DemoPoster from "@/components/video/DemoPoster";
import { CoverThumb } from "@/components/submissions/PostPreview";
import {
  clearPublished,
  clearSproutSends,
  fromSubmission,
  recordSproutSend,
  sampleItems,
  usePublished,
  useSentToSprout,
  type SproutRecord,
} from "@/lib/contentCalendar";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { CalendarItem } from "@/types/calendar";

// ---------------------------------------------------------------------------
// Where each approved post stands with Sprout Social
// ---------------------------------------------------------------------------

type SproutState = "NOT_SENT" | "SCHEDULED" | "PUBLISHED" | "MISSED";

function stateOf(item: CalendarItem, sent: Record<string, SproutRecord>, now: Date): SproutState {
  const due = new Date(item.publishAt) <= now;
  if (sent[item.id]) return due ? "PUBLISHED" : "SCHEDULED";
  return due ? "MISSED" : "NOT_SENT";
}

const STATE: Record<SproutState, { label: string; short: string; dot: string; text: string; box: string }> = {
  NOT_SENT: {
    label: "Approved · not sent to Sprout",
    short: "Not sent",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    box: "bg-amber-50 dark:bg-amber-500/10",
  },
  SCHEDULED: {
    label: "Scheduled in Sprout",
    short: "Scheduled",
    dot: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    box: "bg-blue-50 dark:bg-blue-500/10",
  },
  PUBLISHED: {
    label: "Published",
    short: "Published",
    dot: "bg-zinc-500",
    text: "text-muted-foreground",
    box: "bg-muted",
  },
  MISSED: {
    label: "Past publish time · not sent",
    short: "Not sent",
    dot: "bg-red-600",
    text: "text-red-700 dark:text-red-400",
    box: "bg-red-50 dark:bg-red-500/10",
  },
};
const LEGEND: SproutState[] = ["NOT_SENT", "SCHEDULED", "PUBLISHED", "MISSED"];

type View = "list" | "week" | "month";
const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
const scoreTone = (s: number) =>
  s >= 90
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s >= 60
    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
const profileKey = (i: CalendarItem) => i.account?.id ?? "";
const profileLabel = (i: CalendarItem) => (i.account ? `${i.account.account_name} · ${platformName(i.account.platform)}` : "");

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Thumb({ item, className = "" }: { item: CalendarItem; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
      {item.media ? (
        <CoverThumb cover={item.media} contentType={item.contentType} caption={item.caption} showPlay={false} />
      ) : (
        <DemoPoster variant={item.poster ?? "dusk"} className="h-full w-full" />
      )}
    </div>
  );
}

function Networks({ platforms, size = "w-3.5 h-3.5" }: { platforms: string[]; size?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {platforms.map((p) => (
        <span key={p} className="grid h-5 w-5 place-items-center rounded border border-border/70 bg-background" title={platformName(p)}>
          <PlatformIcon platform={p as SocialPlatform} className={size} />
        </span>
      ))}
    </span>
  );
}

/** One post in a day column, Sprout-calendar style: time and status, networks, caption, picture. */
function PostCard({ item, state, selected, onSelect }: { item: CalendarItem; state: SproutState; selected: boolean; onSelect: () => void }) {
  const st = STATE[state];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full flex-col gap-1.5 rounded-lg border bg-card p-2 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected ? "border-blue-600 ring-2 ring-blue-600/20" : "border-border/70"
      }`}
    >
      <span className="flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden />
          {format(new Date(item.publishAt), "h:mm a")}
        </span>
        {item.score != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${scoreTone(item.score)}`}>{item.score}</span>}
      </span>
      <Networks platforms={item.platforms} size="w-3 h-3" />
      <span className="line-clamp-2 text-xs leading-snug text-foreground/90">{item.caption || item.title}</span>
      <Thumb item={item} className="aspect-video w-full" />
      <span className={`text-[11px] font-medium ${st.text}`}>{st.label}</span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? "";
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-auto min-h-12 w-full flex-1 basis-[160px] rounded-none border-0 border-r border-border/70 px-4 py-2 text-left shadow-none focus-visible:ring-inset"
        aria-label={label}
      >
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="text-[13px] font-medium text-foreground">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{current}</span>
        </span>
        <span className="sr-only">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, text]) => (
          <SelectItem key={v} value={v} className="text-[13px]">
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentCalendarPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  // Approved content is company-wide for people who can see everyone's content; otherwise their own.
  const scope = hasPermission("CONTENT_SUBMISSIONS_VIEW") ? "all" : "mine";

  const [view, setView] = useState<View>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState("all");
  const [brand, setBrand] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState<"all" | SproutState>("all");
  const sent = useSentToSprout();
  const published = usePublished();
  const now = new Date();

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    staleTime: 0,
  });
  const { data: options } = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  const brands = options?.brands ?? [];
  const brandName = (code: string) => brands.find((b) => b.code === code)?.name ?? (code || null);

  const items = useMemo(() => {
    const real = submissions.map(fromSubmission).filter((i): i is CalendarItem => Boolean(i));
    return [...real, ...sampleItems()].sort((a, b) => a.publishAt.localeCompare(b.publishAt));
  }, [submissions]);
  const hasSamples = items.some((i) => i.source === "sample");

  const profiles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) if (i.account && !seen.has(profileKey(i))) seen.set(profileKey(i), profileLabel(i));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);
  const platforms = useMemo(() => [...new Set(items.flatMap((i) => i.platforms))].sort(), [items]);

  const visible = items.filter(
    (i) =>
      (profile === "all" || profileKey(i) === profile) &&
      (brand === "all" || i.brand === brand) &&
      (platform === "all" || i.platforms.includes(platform)) &&
      (status === "all" || stateOf(i, sent, now) === status)
  );

  // The days on screen: a week, or the month around the week (whole weeks).
  const month = startOfMonth(addDays(weekStart, 3));
  const days =
    view === "month"
      ? eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
      : eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const onDay = (day: Date) => visible.filter((i) => isSameDay(new Date(i.publishAt), day));
  const inRange = days.flatMap(onDay);

  // The side panel shows the picked post, or the first one in view that still needs sending.
  const selected =
    visible.find((i) => i.id === selectedId) ??
    inRange.find((i) => stateOf(i, sent, now) === "NOT_SENT") ??
    inRange[0] ??
    null;

  const step = (dir: 1 | -1) =>
    setWeekStart((w) => (view === "month" ? startOfWeek(startOfMonth(addMonths(month, dir)), { weekStartsOn: 1 }) : addWeeks(w, dir)));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const title = view === "month" ? format(month, "MMMM yyyy") : `Week of ${format(weekStart, "MMM d, yyyy")}`;
  const anyActivity = Object.keys(sent).length > 0 || Object.keys(published).length > 0;
  const filtersOn = [profile, brand, platform, status].some((v) => v !== "all");

  const send = (item: CalendarItem) => {
    // Keep it open, so the panel shows it as scheduled rather than jumping to the next one.
    setSelectedId(item.id);
    recordSproutSend(item.id);
    toast.success(`${item.referenceCode} sent to Sprout Social (simulated) and scheduled for ${format(new Date(item.publishAt), "EEE, MMM d · h:mm a")}.`);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6 animate-in fade-in duration-300 min-[112.5rem]:max-w-[2400px]">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Content calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Approved posts by publish date. Send them to Sprout Social to schedule and publish.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground"
            title="The Sprout Social API isn't connected yet. Sending is simulated in this browser."
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> Sprout Social: not connected yet · sending is simulated
          </span>
          {hasSamples && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <FlaskConical className="w-3.5 h-3.5" /> Sample posts included
            </span>
          )}
          {anyActivity && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                clearSproutSends();
                clearPublished();
              }}
              title="Clear the simulated sends and publishes"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset demo
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:flex-row">
        {/* ===== Calendar ===== */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label={view === "month" ? "Previous month" : "Previous week"}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label={view === "month" ? "Next month" : "Next week"}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="ml-1 text-lg font-semibold text-foreground" aria-live="polite">
              {title}
            </h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label="View" className="flex rounded-lg bg-muted p-0.5">
                {(["list", "week", "month"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    onClick={() => setView(v)}
                    className={`h-7 rounded-md px-3 text-[13px] font-medium capitalize transition-colors ${
                      view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {!isReviewer && (
                <Button asChild size="sm" className="h-8 gap-1.5 bg-blue-700 text-xs text-white hover:bg-blue-800">
                  <Link to="/submissions/new">
                    <Plus className="w-3.5 h-3.5" /> New post
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-stretch border-b border-border/70">
            <FilterSelect label="Profiles" value={profile} onChange={setProfile} options={[["all", `All ${profiles.length} profiles`], ...profiles]} />
            <FilterSelect label="Brands" value={brand} onChange={setBrand} options={[["all", "All brands"], ...brands.map((b): [string, string] => [b.code, b.name])]} />
            <FilterSelect label="Platforms" value={platform} onChange={setPlatform} options={[["all", "All platforms"], ...platforms.map((p): [string, string] => [p, platformName(p)])]} />
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => setStatus(v as "all" | SproutState)}
              options={[["all", "Every status"], ...LEGEND.map((s): [string, string] => [s, STATE[s].label])]}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-muted-foreground">
              {LEGEND.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATE[s].dot}`} aria-hidden /> {STATE[s].label}
                </span>
              ))}
              {filtersOn && (
                <button
                  type="button"
                  className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                  onClick={() => {
                    setProfile("all");
                    setBrand("all");
                    setPlatform("all");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Views */}
          {view === "week" && (
            <div className="overflow-x-auto">
              <div className="grid min-w-[960px] grid-cols-[repeat(7,minmax(0,1fr))]">
                {days.map((day) => {
                  const today = isToday(day);
                  const dayItems = onDay(day);
                  return (
                    <div key={day.toISOString()} className={`flex min-h-[560px] flex-col border-r border-border/50 last:border-r-0 ${today ? "bg-blue-50/40 dark:bg-blue-500/5" : ""}`}>
                      <div className={`flex items-center justify-between border-b border-border/70 px-2.5 py-2 ${today ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}>
                        <span className="flex items-baseline gap-1.5">
                          <span className={`text-[13px] font-semibold ${today ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>{format(day, "EEE")}</span>
                          <span className={`text-[13px] ${today ? "font-bold text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>{format(day, "d")}</span>
                        </span>
                        {!isReviewer && (
                          <Link to="/submissions/new" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`New post for ${format(day, "EEEE, MMM d")}`}>
                            <Plus className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 p-1.5">
                        {dayItems.map((i) => (
                          <PostCard key={i.id} item={i} state={stateOf(i, sent, now)} selected={selected?.id === i.id} onSelect={() => setSelectedId(i.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "month" && (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-border/70 bg-muted/30 text-center text-xs font-medium text-muted-foreground">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="py-1.5">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
                  {days.map((day) => {
                    const dayItems = onDay(day);
                    return (
                      <div key={day.toISOString()} className={`min-h-[118px] min-w-0 border-b border-r border-border/50 p-1.5 ${isSameMonth(day, month) ? "" : "bg-muted/20"}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                            setView("week");
                          }}
                          title="Open this week"
                          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                            isToday(day) ? "bg-blue-700 text-white" : isSameMonth(day, month) ? "text-foreground hover:bg-muted" : "text-muted-foreground/60 hover:bg-muted"
                          }`}
                        >
                          {format(day, "d")}
                        </button>
                        <div className="mt-1 flex flex-col gap-1">
                          {dayItems.slice(0, 3).map((i) => {
                            const st = stateOf(i, sent, now);
                            return (
                              <button
                                key={i.id}
                                type="button"
                                onClick={() => setSelectedId(i.id)}
                                className={`flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] ${
                                  selected?.id === i.id ? "border-blue-600 bg-blue-50/60 dark:bg-blue-500/10" : "border-border/70 bg-card hover:bg-muted/40"
                                }`}
                                title={`${i.title} · ${STATE[st].label}`}
                              >
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATE[st].dot}`} aria-hidden />
                                <span className="shrink-0 tabular-nums text-muted-foreground">{format(new Date(i.publishAt), "h:mma").toLowerCase()}</span>
                                <span className="truncate font-medium text-foreground">{i.title}</span>
                              </button>
                            );
                          })}
                          {dayItems.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{dayItems.length - 3} more</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === "list" && (
            <div className="divide-y divide-border/60">
              {days.map((day) => {
                const dayItems = onDay(day);
                if (!dayItems.length) return null;
                return (
                  <div key={day.toISOString()}>
                    <p className={`bg-muted/30 px-4 py-1.5 text-xs font-semibold ${isToday(day) ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>
                      {format(day, "EEEE, MMM d")}
                      {isToday(day) && " · Today"}
                    </p>
                    {dayItems.map((i) => {
                      const st = stateOf(i, sent, now);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => setSelectedId(i.id)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 ${selected?.id === i.id ? "bg-blue-50/60 dark:bg-blue-500/10" : ""}`}
                        >
                          <span className="w-16 shrink-0 text-xs font-semibold tabular-nums">{format(new Date(i.publishAt), "h:mm a")}</span>
                          <Thumb item={i} className="aspect-video w-16 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{i.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{i.caption}</span>
                          </span>
                          <Networks platforms={i.platforms} />
                          {i.score != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${scoreTone(i.score)}`}>{i.score}</span>}
                          <span className={`hidden w-44 shrink-0 text-xs font-medium sm:block ${STATE[st].text}`}>{STATE[st].label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {inRange.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing approved for this week.</p>}
            </div>
          )}
        </div>

        {/* ===== Selected post ===== */}
        <aside aria-label="Selected post" className="flex shrink-0 flex-col border-t border-border/70 lg:w-[340px] lg:border-l lg:border-t-0 min-[112.5rem]:w-[420px]">
          {selected ? (
            <SelectedPost
              item={selected}
              state={stateOf(selected, sent, now)}
              record={sent[selected.id]}
              brand={brandName(selected.brand)}
              onSend={() => send(selected)}
              onPublishDirect={() => navigate(`/content-calendar/publish/${selected.id}/${selected.platforms[0]}`)}
            />
          ) : (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing approved in view. Pick another week, or clear the filters.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function SelectedPost({
  item,
  state,
  record,
  brand,
  onSend,
  onPublishDirect,
}: {
  item: CalendarItem;
  state: SproutState;
  record?: SproutRecord;
  brand: string | null;
  onSend: () => void;
  onPublishDirect: () => void;
}) {
  const st = STATE[state];
  const when = new Date(item.publishAt);
  const help =
    state === "NOT_SENT"
      ? `Approved here, not in Sprout yet. Sending creates the post in Sprout for each profile, scheduled for ${format(when, "EEE, MMM d")} at ${format(when, "h:mm a")}.`
      : state === "MISSED"
      ? "Its planned time has passed and it was never sent. Sending it now means Sprout publishes it right away; reschedule it first if that's too soon."
      : state === "SCHEDULED"
      ? `Scheduled in Sprout Social${record ? ` (sent ${format(new Date(record.at), "MMM d, h:mm a")})` : ""}. Changes to the time or text are made in Sprout and sync back here.`
      : "Published through Sprout Social. Its numbers will appear in Post performance once Sprout analytics is connected.";

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 border-b border-border/70 p-4">
        <span className="text-xs text-muted-foreground">{format(when, "EEEE, MMM d · h:mm a")}</span>
        <h3 className="text-base font-semibold leading-snug text-foreground">{item.title}</h3>
        <span className="text-xs text-muted-foreground">
          {item.referenceCode}
          {brand && ` · ${brand}`}
          {item.source === "sample" && " · Sample"}
        </span>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <Thumb item={item} className="aspect-video w-full rounded-lg" />
        <p className="whitespace-pre-line text-[13px] text-foreground/90">{item.caption}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border/70 p-2.5">
            <p className="text-xs text-muted-foreground">Compliance</p>
            <p className="mt-0.5 font-semibold tabular-nums text-foreground">{item.score != null ? `${item.score} / 100` : "–"}</p>
          </div>
          <div className="rounded-lg border border-border/70 p-2.5">
            <p className="text-xs text-muted-foreground">Approved by</p>
            <p className="mt-0.5 truncate font-semibold text-foreground">{item.approvedBy ?? "Reviewer"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">Profiles</span>
          {item.platforms.map((p) => (
            <div key={p} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-2.5 py-2">
              <span className="flex min-w-0 items-center gap-2 text-[13px]">
                <PlatformIcon platform={p as SocialPlatform} className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {item.account && item.account.platform === p ? `${item.account.account_name} · ` : ""}
                  {platformName(p)}
                </span>
                {item.account?.is_ceo && item.account.platform === p && <Crown className="w-3 h-3 shrink-0 text-amber-600" aria-label="Shaun's channel" />}
              </span>
              <span className={`shrink-0 text-xs font-medium ${st.text}`}>{st.short}</span>
            </div>
          ))}
        </div>
        <div className={`flex flex-col gap-2.5 rounded-lg p-3 ${st.box}`}>
          <p className="text-[13px] text-foreground/90">{help}</p>
          {(state === "NOT_SENT" || state === "MISSED") && (
            <Button className="h-9 gap-1.5 bg-blue-700 text-white hover:bg-blue-800" onClick={onSend}>
              <Send className="w-4 h-4" /> {state === "MISSED" ? "Send to Sprout now" : "Send to Sprout and schedule"}
            </Button>
          )}
          {(state === "SCHEDULED" || state === "PUBLISHED") && (
            <Button variant="outline" className="h-9 gap-1.5" disabled title="Available once the Sprout Social API is connected">
              <ExternalLink className="w-4 h-4" /> Open in Sprout Social
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {item.submissionId && (
            <Link to={`/submissions/${item.submissionId}`} className="font-medium text-blue-700 hover:underline dark:text-blue-300">
              Open details
            </Link>
          )}
          <button type="button" onClick={onPublishDirect} className="font-medium text-muted-foreground hover:text-foreground hover:underline">
            Publish on each platform without Sprout
          </button>
        </div>
      </div>
    </div>
  );
}
