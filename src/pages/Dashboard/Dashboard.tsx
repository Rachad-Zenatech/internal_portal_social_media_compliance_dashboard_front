import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { CalendarDays, CheckCircle2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import DayAgenda from "@/components/dashboard/DayAgenda";
import ReviewSlideshow from "@/components/dashboard/ReviewSlideshow";
import ListPager from "@/components/common/ListPager";
import { usePaged } from "@/hooks/usePaged";
import ReviewerStats, { type QueueFilter } from "@/components/dashboard/ReviewerStats";
import SuggesterDashboard from "@/components/dashboard/SuggesterDashboard";
import {
  ActivityList,
  DeadlinePill,
  Loading,
  Platforms,
  Score,
  Section,
  Thumb,
  greeting,
  issuesText,
} from "@/components/dashboard/dashboardParts";
import { audienceCodes, audienceNames, refetchWhileAnalysing } from "@/components/submissions/submissionUi";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useAuth } from "@/lib/AuthContext";
import { scriptService } from "@/services/scriptService";
import { submissionService } from "@/services/submissionService";
import type { ScriptQueueItem } from "@/types/script";
import type { SubmissionSummary } from "@/types/submission";

/** Suggesting reviewers get their own; reviewers get the reviewer's dashboard; creators (and super admins viewing the app as a creator) their own. */
export default function Dashboard() {
  const { hasPermission, isSuggester } = useAuth();
  if (isSuggester) return <SuggesterDashboard />;
  return hasPermission("CONTENT_REVIEW_VIEW") ? <ReviewerDashboard /> : <CreatorDashboard />;
}

const ACTIVITY_LIMIT = 5;
const WAITING_PAGE_SIZE = 6;

/** A check that would stop approval or clearly needs work: a red result, or a score under 60. */
const isFailing = (s: SubmissionSummary) =>
  !s.analysis_pending && (s.latest_traffic_light === "RED" || (s.latest_score != null && s.latest_score < 60));

/** What waits for a reviewer: a post, or a video's script. They're counted and listed together. */
type QueueRow = { kind: "post"; s: SubmissionSummary } | { kind: "script"; s: ScriptQueueItem };
const rowDue = (r: QueueRow) => (r.kind === "post" ? r.s.due_at : r.s.approval_needed_by);
const rowSent = (r: QueueRow) => (r.kind === "post" ? r.s.submitted_at ?? r.s.created_at : r.s.sent_at);
const rowOverdue = (r: QueueRow) => Boolean(rowDue(r) && isPast(new Date(rowDue(r)!)));
const rowFailing = (r: QueueRow) =>
  r.kind === "post" ? isFailing(r.s) : !r.s.ai_unavailable && (r.s.traffic_light === "RED" || (r.s.score != null && r.s.score < 60));

function ReviewerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setActiveVideoId } = useVideoUploadQueue();
  const now = useMemo(() => new Date(), []);

  // Reviewers see everyone's content on their brands, as in the Content Screener.
  const submissions = useQuery({
    queryKey: ["submissions", "all"],
    queryFn: () => submissionService.list(undefined, "all"),
    staleTime: 0,
    refetchInterval: refetchWhileAnalysing,
  });
  const summary = useQuery({
    queryKey: ["dashboard-summary", "all"],
    queryFn: () => submissionService.dashboard("all"),
    staleTime: 60_000,
  });
  // Scripts waiting for a review are part of the queue too.
  const scripts = useQuery({
    queryKey: ["script-queue", "review"],
    queryFn: () => scriptService.queue("review"),
    staleTime: 0,
  });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  const audienceName = (x: { audience?: string | null; audiences?: string[] }) => audienceNames(audienceCodes(x), options.data?.audiences) ?? "Not set";

  const all = useMemo(() => submissions.data ?? [], [submissions.data]);
  const needsMyReview = useMemo<QueueRow[]>(
    () =>
      [
        ...all.filter((s) => s.status === "IN_REVIEW" && s.can_review).map((s): QueueRow => ({ kind: "post", s })),
        ...(scripts.data ?? []).filter((s) => s.can_review).map((s): QueueRow => ({ kind: "script", s })),
      ].sort(
        (a, b) =>
          (rowDue(a) ? new Date(rowDue(a)!).getTime() : Infinity) - (rowDue(b) ? new Date(rowDue(b)!).getTime() : Infinity) ||
          new Date(rowSent(a)).getTime() - new Date(rowSent(b)).getTime()
      ),
    [all, scripts.data]
  );
  const waitingPosts = needsMyReview.filter((r) => r.kind === "post").length;
  const waitingScripts = needsMyReview.length - waitingPosts;
  const overdue = needsMyReview.filter(rowOverdue).length;
  const failing = needsMyReview.filter(rowFailing).length;
  const soonest = needsMyReview.find((r) => rowDue(r) && !rowOverdue(r));
  const oldestSent = needsMyReview.reduce<Date | null>((oldest, r) => {
    const at = rowSent(r) ? new Date(rowSent(r)) : null;
    return at && (!oldest || at < oldest) ? at : oldest;
  }, null);

  const openInScreener = (id: string) => {
    setActiveVideoId(`sub-${id}`);
    navigate("/compliance/scanner");
  };
  const openRow = (r: QueueRow) => (r.kind === "script" ? navigate(`/script-review/scripts/${r.s.id}`) : openInScreener(r.s.id));

  // Sent back for changes and now with the creator: late first, then soonest due back, then those with no date.
  const sentBack = useMemo(() => {
    const dueBack = (x: SubmissionSummary) => (x.due_kind === "REVISION" && x.due_at ? new Date(x.due_at).getTime() : Infinity);
    return all.filter((x) => x.status === "CHANGES_REQUESTED").sort((a, b) => dueBack(a) - dueBack(b));
  }, [all]);
  // Six to a page, so the panel never grows past three rows.
  const waitingPaged = usePaged(sentBack, WAITING_PAGE_SIZE);
  const lateBack = sentBack.filter((x) => x.due_kind === "REVISION" && x.due_at && isPast(new Date(x.due_at))).length;

  // The cards narrow the list to what is overdue or failing.
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const queue = queueFilter === "overdue" ? needsMyReview.filter(rowOverdue) : queueFilter === "failing" ? needsMyReview.filter(rowFailing) : needsMyReview;
  const changeFilter = (f: QueueFilter) => setQueueFilter(f);

  /** One slide: the post's picture (or a script's page) with its deadline, then what it is, its score and Review.
   * Late and failing ones have a red edge so they stand out. */
  const slide = (row: QueueRow) => {
    const isScript = row.kind === "script";
    const urgent = rowOverdue(row) && rowFailing(row);
    const creator = row.kind === "script" ? row.s.creator_name : row.s.created_by_name;
    const version = row.kind === "script" ? row.s.version_number : row.s.current_version;
    return (
      <article
        className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md ${
          urgent ? "border-red-300 ring-1 ring-red-200 dark:border-red-500/50 dark:ring-red-500/30" : "border-border/70"
        }`}
      >
        <button type="button" onClick={() => openRow(row)} aria-label={`Review ${row.s.title}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-muted">
          {row.kind === "script" ? (
            <span className="grid h-full w-full place-items-center bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <FileText className="h-10 w-10" strokeWidth={1.5} />
            </span>
          ) : (
            <Thumb s={row.s} className="h-full w-full rounded-none transition-transform duration-300 group-hover:scale-[1.03]" />
          )}
          <span className="absolute left-2 top-2">
            <DeadlinePill dueAt={rowDue(row)} />
          </span>
        </button>
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <div className="min-w-0">
            <p className="line-clamp-2 font-semibold leading-snug text-foreground" title={row.s.title}>
              {row.s.title}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {isScript ? (
                <span className="rounded bg-blue-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  Script
                </span>
              ) : (
                row.kind === "post" && <Platforms platforms={row.s.platforms} />
              )}
              <span>
                by {creator ?? "Unknown"}
                {version > 1 && ` · v${version}`}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{audienceName(row.s)}</p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/60 pt-2.5">
            {row.kind === "script" ? (
              <Score score={row.s.score} unavailable={row.s.ai_unavailable} />
            ) : (
              <div className="flex min-w-0 flex-col gap-0.5">
                <Score score={row.s.latest_score} pending={row.s.analysis_pending} progress={row.s.analysis_progress} unavailable={row.s.ai_unavailable} />
                {!row.s.analysis_pending && row.s.latest_score != null && (
                  <span className="truncate text-xs text-muted-foreground">{issuesText(row.s.issue_count)?.replace("to fix", "found") ?? "No issues"}</span>
                )}
              </div>
            )}
            <Button size="sm" className="h-8 shrink-0 rounded-lg bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800" onClick={() => openRow(row)}>
              Review
            </Button>
          </div>
        </div>
      </article>
    );
  };

  // The team's activity, minus the reviewer's own actions.
  const activity = (summary.data?.activity ?? []).filter((a) => a.actor_id !== user?.id).slice(0, ACTIVITY_LIMIT);

  const loading = submissions.isLoading || scripts.isLoading;
  const waiting = needsMyReview.length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // "4 posts and 3 scripts", or just the one kind when that's all there is.
  const breakdown = [waitingPosts ? plural(waitingPosts, "post") : null, waitingScripts ? plural(waitingScripts, "script") : null]
    .filter(Boolean)
    .join(" and ");
  const headline = loading
    ? ""
    : waiting === 0
    ? "Nothing is waiting for your review."
    : `${breakdown} ${waiting === 1 ? "is" : "are"} waiting for your review.${overdue ? ` ${overdue} ${overdue === 1 ? "is" : "are"} overdue.` : ""}`;

  const s = summary.data;
  const waitingNote =
    [
      waitingPosts && waitingScripts ? `${plural(waitingPosts, "post")}, ${plural(waitingScripts, "script")}` : null,
      soonest && rowDue(soonest) ? `Next due ${format(new Date(rowDue(soonest)!), "EEE, MMM d")}` : oldestSent ? `Oldest sent ${formatDistanceToNow(oldestSent)} ago` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  return (
    <div data-canvas="contrast" className="mx-auto w-full max-w-[1400px] space-y-6 pb-8 animate-in fade-in duration-300 min-[112.5rem]:max-w-[2200px]">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {greeting(now)}
            {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10 gap-2 rounded-lg px-4 font-medium">
            <Link to="/content-calendar">
              <CalendarDays className="w-4 h-4" /> Calendar
            </Link>
          </Button>
          <Button
            className="h-10 rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
            onClick={() => (needsMyReview[0] ? openRow(needsMyReview[0]) : navigate("/compliance/scanner"))}
          >
            {waiting ? "Start reviewing" : "Open Content screener"}
          </Button>
        </div>
      </div>

      <ReviewerStats
        loading={loading}
        waiting={waiting}
        waitingNote={waitingNote}
        overdue={overdue}
        failing={failing}
        summary={s}
        filter={queueFilter}
        onFilter={changeFilter}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] min-[112.5rem]:grid-cols-[minmax(0,1fr)_480px]">
        {/* Left: the queue, and how reviewing is going */}
        <div className="flex min-w-0 flex-col gap-6">
          <div id="reviewer-queue" className="scroll-mt-4">
          <Section
            title="Needs your review"
            count={loading || !queue.length ? undefined : queue.length}
            subtitle={queueFilter === "overdue" ? "Only what is overdue" : queueFilter === "failing" ? "Only what has a failing check" : "Soonest deadline first"}
            action={
              <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {queueFilter !== "all" && (
                  <button type="button" onClick={() => changeFilter("all")} className="hover:underline">
                    Show everything
                  </button>
                )}
                <Link to="/compliance/scanner" className="hover:underline">
                  View all
                </Link>
              </div>
            }
          >
            {loading ? (
              <Loading />
            ) : queue.length === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">{queueFilter === "all" ? "All caught up" : "Nothing here"}</p>
                <p className="text-xs text-muted-foreground">
                  {queueFilter === "all" ? "Nothing is waiting for your review." : "None of what is waiting matches this."}
                </p>
              </div>
            ) : (
              <div className="border-t border-border/60 pt-3">
                <ReviewSlideshow key={queueFilter} label="Needs your review" slides={queue.map((row) => ({ key: `${row.kind}-${row.s.id}`, node: slide(row) }))} />
              </div>
            )}
          </Section>
          </div>

          <Section
            title="Waiting on creators"
            count={loading || !sentBack.length ? undefined : sentBack.length}
            subtitle={lateBack ? `Sent back for changes · ${lateBack} late to come back` : "Sent back for changes · soonest due back first"}
          >
            {loading ? (
              <Loading />
            ) : sentBack.length === 0 ? (
              <p className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">Nothing is with a creator for changes right now.</p>
            ) : (
              <>
              <ul className="grid gap-3 border-t border-border/60 p-4 sm:grid-cols-2 min-[112.5rem]:grid-cols-3">
                {waitingPaged.pageItems.map((x) => {
                  const due = x.due_kind === "REVISION" ? x.due_at : null;
                  const late = Boolean(due && isPast(new Date(due)));
                  return (
                    <li key={x.id}>
                      <Link
                        to={`/submissions/${x.id}`}
                        className={`flex h-full items-center gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md ${
                          late ? "border-red-300 dark:border-red-500/50" : "border-border/70"
                        }`}
                      >
                        <Thumb s={x} className="h-14 w-20 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground" title={x.title}>
                            {x.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            With {x.created_by_name ?? "the creator"}
                            {x.current_version > 1 && ` · v${x.current_version}`}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {issuesText(x.issue_count) ?? "Changes requested"} · updated {formatDistanceToNow(new Date(x.updated_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Due back</span>
                          <DeadlinePill dueAt={due} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <ListPager
                className="border-t border-border/60 px-4 py-2.5"
                page={waitingPaged.page}
                pageCount={waitingPaged.pageCount}
                pageSize={waitingPaged.pageSize}
                total={waitingPaged.total}
                noun="posts"
                onPage={waitingPaged.setPage}
              />
              </>
            )}
          </Section>
        </div>

        {/* Right: the day's schedule, and what the team did */}
        <div className="flex min-w-0 flex-col gap-6">
          <DayAgenda posts={all} loading={loading} />
          <Section title="Activity" subtitle="What creators and other reviewers did">
            <ActivityList items={activity} loading={summary.isLoading} empty="No recent activity from your team." />
          </Section>
        </div>
      </div>
    </div>
  );
}
