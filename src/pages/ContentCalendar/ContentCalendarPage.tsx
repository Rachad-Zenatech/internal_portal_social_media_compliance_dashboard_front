import CalendarViews from "./CalendarViews";
import { PostCard, Thumb, CalendarSummaryPost } from "./CalendarPostCard";
import { STATE, LEGEND, stateOf, platformName, type SproutState } from "./calendarPresentation";
import { useCalendarSend } from "@/hooks/useCalendarSend";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCalendarSelection } from "@/hooks/useCalendarSelection";
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
  startOfMonth,
  startOfWeek,
} from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { ChevronLeft, ChevronRight, Crown, ExternalLink, FlaskConical, Plus, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import MultiSelectFilter from "@/components/ui/MultiSelectFilter";
import PlatformIcon, { type SocialPlatform } from "@/components/video/PlatformIcon";
import {
  clearPublished,
  clearSproutSends,
  fromSubmission,
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

type View = "list" | "week" | "month";
const profileKey = (i: CalendarItem) => i.account?.id ?? "";
const profileLabel = (i: CalendarItem) => (i.account ? `${i.account.account_name} · ${platformName(i.account.platform)}` : "");

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The look of a filter in the bar above the calendar: flush cells separated by a rule, title over the choice. */
const BAR_FILTER =
  "h-auto min-h-12 w-full flex-1 basis-[160px] rounded-none border-0 border-r border-border/70 bg-transparent px-4 py-2 text-left shadow-none hover:bg-muted/40";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentCalendarPage() {
  const { time_zone } = useUserTimezone();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_VIEW");
  // Approved content is company-wide for people who can see everyone's content; otherwise their own.
  const scope = hasPermission("CONTENT_SUBMISSIONS_VIEW") ? "all" : "mine";

  const [view, setView] = useState<View>("week");
  const { weekStart, setWeekStart, selectedId, setSelectedId } = useCalendarSelection();
  // Each filter takes several values; none picked means all.
  const [profileSel, setProfileSel] = useState<string[]>([]);
  const [brandSel, setBrandSel] = useState<string[]>([]);
  const [platformSel, setPlatformSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<string[]>([]);
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
    const real = submissions.map((s) => fromSubmission({ ...s, publish_at: sent[`sub-${s.id}`]?.scheduled_for ?? s.publish_at })).filter((i): i is CalendarItem => Boolean(i));
    return [...real, ...sampleItems()].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  }, [submissions, sent, time_zone]);
  const hasSamples = items.some((i) => i.is_sample);
  const profiles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) if (i.account && !seen.has(profileKey(i))) seen.set(profileKey(i), profileLabel(i));
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);
  const platforms = useMemo(() => [...new Set(items.flatMap((i) => i.platforms))].sort(), [items]);

  const visible = items.filter(
    (i) =>
      (profileSel.length === 0 || profileSel.includes(profileKey(i))) &&
      (brandSel.length === 0 || (i.brand_code != null && brandSel.includes(i.brand_code))) &&
      (platformSel.length === 0 || i.platforms.some((p) => platformSel.includes(p))) &&
      (statusSel.length === 0 || statusSel.includes(stateOf(i, sent, now)))
  );

  // The days on screen: a week, or the month around the week (whole weeks).
  const month = startOfMonth(addDays(weekStart, 3));
  const days =
    view === "month"
      ? eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
      : eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const onDay = (day: Date) => visible.filter((i) => isSameDay(new Date(i.scheduled_for), day));
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
  const filtersOn = [profileSel, brandSel, platformSel, statusSel].some((v) => v.length > 0);

  const send = useCalendarSend(setSelectedId);

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
            <MultiSelectFilter
              title="Profiles"
              options={profiles.map(([value, label]) => ({ value, label }))}
              value={profileSel}
              onChange={setProfileSel}
              allLabel={`All ${profiles.length} profiles`}
              noun="profile"
              className={BAR_FILTER}
            />
            <MultiSelectFilter
              title="Brands"
              options={brands.map((b) => ({ value: b.code, label: b.name }))}
              value={brandSel}
              onChange={setBrandSel}
              allLabel="All brands"
              noun="brand"
              className={BAR_FILTER}
            />
            <MultiSelectFilter
              title="Platforms"
              options={platforms.map((p) => ({ value: p, label: platformName(p) }))}
              value={platformSel}
              onChange={setPlatformSel}
              allLabel="All platforms"
              noun="platform"
              className={BAR_FILTER}
            />
            <MultiSelectFilter
              title="Status"
              options={LEGEND.map((s) => ({ value: s, label: STATE[s].label }))}
              value={statusSel}
              onChange={setStatusSel}
              allLabel="Every status"
              noun="status"
              className={BAR_FILTER}
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
                    setProfileSel([]);
                    setBrandSel([]);
                    setPlatformSel([]);
                    setStatusSel([]);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <CalendarViews
            view={view} days={days} month={month} isReviewer={isReviewer} onDay={onDay}
            openWeek={(day) => { setWeekStart(startOfWeek(day, { weekStartsOn: 1 })); setView("week"); }}
            renderPost={(item) => <PostCard item={item} state={stateOf(item, sent, now)} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />}
            renderSummary={(item, compact) => <CalendarSummaryPost item={item} state={stateOf(item, sent, now)} selected={selected?.id === item.id} compact={compact} onSelect={() => setSelectedId(item.id)} />}
          />
        </div>

        {/* ===== Selected post ===== */}
        <aside aria-label="Selected post" className="flex shrink-0 flex-col border-t border-border/70 lg:w-[340px] lg:border-l lg:border-t-0 min-[112.5rem]:w-[420px]">
          {selected ? (
            <SelectedPost
              item={selected}
              state={stateOf(selected, sent, now)}
              record={sent[selected.id]}
              brand={brandName(selected.brand_code)}
              isCreator={!selected.submission_id || Boolean(user && selected.created_by === user.id) || !isReviewer}
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
  isCreator,
  onSend,
  onPublishDirect,
}: {
  item: CalendarItem;
  state: SproutState;
  record?: SproutRecord;
  brand: string | null;
  isCreator: boolean;
  onSend: () => void;
  onPublishDirect: () => void;
}) {
  const st = STATE[state];
  const when = new Date(item.scheduled_for);
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
          {item.reference_code}
          {brand && ` · ${brand}`}
          {item.is_sample && " · Sample"}
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
            <p className="mt-0.5 truncate font-semibold text-foreground">{item.approved_by ?? "Reviewer"}</p>
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
          {isCreator ? (
            <>
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
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Approved · ready for the post's creator to publish or schedule.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {item.submission_id && (
            <Link to={`/submissions/${item.submission_id}`} className="font-medium text-blue-700 hover:underline dark:text-blue-300">
              Open details
            </Link>
          )}
          {isCreator && (
            <button type="button" onClick={onPublishDirect} className="font-medium text-muted-foreground hover:text-foreground hover:underline">
              Publish on each platform without Sprout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
