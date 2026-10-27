import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Plus,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CoverThumb } from "@/components/submissions/PostPreview";
import PlatformIcon, { type SocialPlatform } from "@/components/video/PlatformIcon";
import {
  Empty,
  Loading,
  QUICK_CREATE,
  STATUS_PILL,
  Score,
  Section,
  Thumb,
  UPCOMING_DAYS,
  statusOf,
} from "@/components/dashboard/dashboardParts";
import NotificationsPanel from "@/components/dashboard/NotificationsPanel";
import WeekAhead from "@/components/dashboard/WeekAhead";
import PipelineSection, { type PipelineStage } from "@/components/dashboard/PipelineSection";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// What the creator's dashboard shows, in their own words and colours
// ---------------------------------------------------------------------------

// Stage colours match the Content Portal's status pills: one fixed colour per stage everywhere.
const STAGES: PipelineStage[] = [
  { key: "CHANGES_REQUESTED", label: "Needs your changes", bar: "bg-amber-500", to: "/submissions" },
  { key: "DRAFT", label: "Drafts", bar: "bg-slate-400", to: "/submissions" },
  { key: "IN_REVIEW", label: "In review", bar: "bg-blue-500", to: "/submissions" },
  { key: "SCHEDULED", label: "Scheduled", bar: "bg-violet-500", to: "/content-calendar" },
  { key: "APPROVED", label: "Approved", bar: "bg-emerald-500", to: "/submissions" },
];

function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function dueLabel(dueAt?: string | null, verb = "Resubmit") {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (isPast(due)) return { text: `${verb} overdue by ${formatDistanceToNow(due)}`, urgent: true };
  if (isToday(due)) return { text: `${verb} by ${format(due, "h:mm a")} today`, urgent: true };
  if (isTomorrow(due)) return { text: `${verb} by tomorrow, ${format(due, "h:mm a")}`, urgent: false };
  return { text: `${verb} by ${format(due, "EEE MMM d")}`, urgent: false };
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One thing to do next, said plainly: what the post is, what to do with it, and one button. */
function NextStepCard({ s, onOpen }: { s: SubmissionSummary; onOpen: () => void }) {
  const changes = s.status === "CHANGES_REQUESTED";
  const due = changes ? dueLabel(s.due_kind === "REVISION" ? s.due_at : null) : null;
  return (
    <div className="flex items-center gap-4 border-t border-border/60 px-4 py-4">
      <Thumb s={s} className="h-14 w-14 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{s.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {changes ? "A reviewer asked for changes." : "Finish your draft and send it for review."}
          {due && <span className={due.urgent ? " font-semibold text-red-600 dark:text-red-400" : ""}> {due.text}.</span>}
        </p>
      </div>
      <Button
        onClick={onOpen}
        className={`h-9 shrink-0 gap-1.5 rounded-lg px-4 text-sm font-semibold text-white ${
          changes ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {changes ? "Make changes" : "Continue"} <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

const RECENT_LIMIT = 3;

type SortKey = "newest" | "oldest" | "score-high" | "score-low";
const SORTS: { v: SortKey; label: string }[] = [
  { v: "newest", label: "Newest first" },
  { v: "oldest", label: "Oldest first" },
  { v: "score-high", label: "Highest score" },
  { v: "score-low", label: "Lowest score" },
];

/** One post they've sent for review: where it goes, what it says, what it shows, and how it scored. */
function RecentPostCard({ s, rank, brand }: { s: SubmissionSummary; rank: number; brand: string | null }) {
  const platform = s.platforms[0] as SocialPlatform | undefined;
  const status = STATUS_PILL[statusOf(s)] ?? { label: s.status, pill: "bg-muted text-muted-foreground" };
  const who = s.account?.handle ? `@${s.account.handle.replace(/^@/, "")}` : s.account?.label ?? brand ?? "No account set";
  return (
    <li className="relative -mb-px -mr-px flex min-w-0 flex-col border-b border-r border-border/60 px-4 pb-3 pt-5">
      <span className="absolute left-1/2 top-0 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-[10px] font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 bg-muted/40 text-foreground">
          {platform ? <PlatformIcon platform={platform} className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-muted-foreground" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{who}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {format(new Date(s.submitted_at!), "EEE MMM d, h:mm a")}
            {brand && ` · ${brand}`}
          </p>
        </div>
      </div>
      <Link to={`/submissions/${s.id}`} className="mt-2 block truncate text-sm font-semibold text-foreground hover:underline">
        {s.title}
      </Link>
      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{s.caption_text || "No caption"}</p>
      <Link to={`/submissions/${s.id}`} className="mt-2 block h-36 overflow-hidden rounded-lg bg-muted">
        <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
      </Link>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.pill}`}>{status.label}</span>
        <Score score={s.latest_score} pending={s.analysis_pending} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** The content creator's dashboard: what needs them, where their posts are, and how they're doing. */
export default function CreatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const submissions = useQuery({
    queryKey: ["submissions", "mine"],
    queryFn: () => submissionService.list(undefined, "mine"),
    staleTime: 0,
  });

  const mine = useMemo(() => (submissions.data ?? []).filter((s) => s.created_by === user?.id), [submissions.data, user?.id]);
  const byStage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of mine) counts[statusOf(s)] = (counts[statusOf(s)] ?? 0) + 1;
    return counts;
  }, [mine]);
  const nextSteps = useMemo(() => {
    const due = (s: SubmissionSummary) => (s.due_at ? new Date(s.due_at).getTime() : Infinity);
    return [
      ...mine.filter((s) => s.status === "CHANGES_REQUESTED").sort((a, b) => due(a) - due(b)),
      ...mine.filter((s) => s.status === "DRAFT").sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    ];
  }, [mine]);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  const brandName = useCallback(
    (code?: string | null) => (code ? options.data?.brands.find((b) => b.code === code)?.name ?? code : null),
    [options.data]
  );
  const sent = useMemo(() => mine.filter((s) => s.status !== "DRAFT" && s.submitted_at), [mine]);
  const sortedSent = useMemo(() => {
    const at = (s: SubmissionSummary) => new Date(s.submitted_at!).getTime();
    const list = [...sent];
    if (sortBy === "newest") list.sort((a, b) => at(b) - at(a));
    else if (sortBy === "oldest") list.sort((a, b) => at(a) - at(b));
    else {
      // Posts still being analysed have no score yet, so they go last either way.
      const dir = sortBy === "score-high" ? -1 : 1;
      list.sort((a, b) => {
        const na = a.latest_score == null ? 1 : 0;
        const nb = b.latest_score == null ? 1 : 0;
        if (na || nb) return na - nb || at(b) - at(a);
        return dir * (a.latest_score! - b.latest_score!) || at(b) - at(a);
      });
    }
    return list;
  }, [sent, sortBy]);

  const loading = submissions.isLoading;


  return (
    <div data-canvas="contrast" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Welcome: what needs them, and a quick way to start */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_oklch(0_0_0/0.05)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Your content
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              {greeting(now)}
              {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
              !
            </h1>
          </div>
          <div className="flex flex-col gap-2.5 lg:items-end">
            <Button asChild className="h-11 w-fit rounded-xl px-5 gap-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-sm">
              <Link to="/submissions/new">
                <Plus className="w-4 h-4" /> Create a post
              </Link>
            </Button>
            <div className="flex flex-wrap gap-1.5" aria-label="Start a new post of this type">
              {QUICK_CREATE.map(({ type, label, Icon }) => (
                <Link
                  key={type}
                  to={`/submissions/new?type=${type}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* What to do next */}
          <Section title="Your Next Step">
            {loading ? (
              <Loading />
            ) : nextSteps.length === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">Nothing waiting on you</p>
                <p className="text-xs text-muted-foreground">No changes requested and no drafts. Create a post when you're ready.</p>
              </div>
            ) : (
              // Only the most urgent step: changes due soonest, then the latest draft.
              <NextStepCard s={nextSteps[0]} onOpen={() => navigate(`/submissions/new?id=${nextSteps[0].id}`)} />
            )}
          </Section>

          {/* What they've sent for review, as cards */}
          <Section
            title="Your Recent Posts"
            subtitle="Posts you've sent for review"
            action={
              <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                Sort by
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger size="sm" className="h-8 w-[150px] bg-card text-xs" aria-label="Sort posts">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((o) => (
                      <SelectItem key={o.v} value={o.v} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            }
          >
            {loading ? (
              <Loading />
            ) : sent.length === 0 ? (
              <Empty>Posts you send for review will show here.</Empty>
            ) : (
              <>
                <ul className="grid grid-cols-1 border-t border-border/60 sm:grid-cols-3">
                  {sortedSent.slice(0, RECENT_LIMIT).map((p, i) => (
                    <RecentPostCard key={p.id} s={p} rank={i + 1} brand={brandName(p.brand_code)} />
                  ))}
                </ul>
                <div className="flex items-center justify-end border-t border-border/60 bg-muted/20 px-4 py-2.5">
                  <Button asChild variant="outline" size="sm" className="h-7 rounded-md px-2.5 text-xs font-semibold">
                    <Link to="/submissions">See all your posts</Link>
                  </Button>
                </div>
              </>
            )}
          </Section>
        </div>

        <div className="space-y-5 min-w-0">
          <NotificationsPanel pageSize={4} />

          {/* Where everything is, as one bar */}
          <PipelineSection stages={STAGES} counts={byStage} total={mine.length} loading={loading}
            title="Your Content Pipeline"
            subtitle="Every post of yours, by stage"
          />
        </div>
      </div>

      {/* The week ahead */}
      <WeekAhead posts={mine} loading={loading} title="Your Scheduled Posts" subtitle={`When your posts go out over the next ${UPCOMING_DAYS} days. Pick a day to see its posts.`} />
    </div>
  );
}
