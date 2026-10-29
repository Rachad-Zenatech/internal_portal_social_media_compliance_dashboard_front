import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import DayAgenda from "@/components/dashboard/DayAgenda";
import {
  ActivityList,
  Deadline,
  Loading,
  Platforms,
  Score,
  Section,
  StatCard,
  Thumb,
  greeting,
  issuesText,
} from "@/components/dashboard/dashboardParts";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { SubmissionSummary } from "@/types/submission";

/** Reviewers get the reviewer's dashboard; creators (and super admins viewing the app as a creator) their own. */
export default function Dashboard() {
  const { hasPermission } = useAuth();
  return hasPermission("CONTENT_REVIEW_APPROVE") ? <ReviewerDashboard /> : <CreatorDashboard />;
}

const REVIEW_PAGE_SIZE = 5;
const ACTIVITY_LIMIT = 5;

/** A check that would stop approval or clearly needs work: a red result, or a score under 60. */
const isFailing = (s: SubmissionSummary) =>
  !s.analysis_pending && (s.latest_traffic_light === "RED" || (s.latest_score != null && s.latest_score < 60));
const isOverdue = (s: SubmissionSummary) => Boolean(s.due_at && isPast(new Date(s.due_at)));

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
  });
  const summary = useQuery({
    queryKey: ["dashboard-summary", "all"],
    queryFn: () => submissionService.dashboard("all"),
    staleTime: 60_000,
  });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  const audienceName = (code?: string | null) => (code ? options.data?.audiences[code] ?? code : "Not set");

  const all = useMemo(() => submissions.data ?? [], [submissions.data]);
  const needsMyReview = useMemo(
    () =>
      all
        .filter((s) => s.status === "IN_REVIEW" && s.can_review)
        .sort(
          (a, b) =>
            (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity) ||
            new Date(a.submitted_at ?? a.created_at).getTime() - new Date(b.submitted_at ?? b.created_at).getTime()
        ),
    [all]
  );
  const overdue = needsMyReview.filter(isOverdue).length;
  const failing = needsMyReview.filter(isFailing).length;
  const soonest = needsMyReview.find((s) => s.due_at && !isOverdue(s));
  const oldestSent = needsMyReview.reduce<Date | null>((oldest, s) => {
    const at = s.submitted_at ? new Date(s.submitted_at) : null;
    return at && (!oldest || at < oldest) ? at : oldest;
  }, null);

  const openInScreener = (id: string) => {
    setActiveVideoId(`sub-${id}`);
    navigate("/compliance/scanner");
  };

  // The review list shows five at a time; reviewed posts drop out, so keep the page in range.
  const [rawReviewPage, setReviewPage] = useState(0);
  const reviewPages = Math.max(1, Math.ceil(needsMyReview.length / REVIEW_PAGE_SIZE));
  const reviewPage = Math.min(rawReviewPage, reviewPages - 1);
  const reviewRows = needsMyReview.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE);

  // The team's activity, minus the reviewer's own actions.
  const activity = (summary.data?.activity ?? []).filter((a) => a.actor_id !== user?.id).slice(0, ACTIVITY_LIMIT);

  const loading = submissions.isLoading;
  const waiting = needsMyReview.length;
  const headline = loading
    ? ""
    : waiting === 0
    ? "Nothing is waiting for your review."
    : `${waiting} post${waiting === 1 ? " is" : "s are"} waiting for your review.${overdue ? ` ${overdue} ${overdue === 1 ? "is" : "are"} overdue.` : ""}`;

  const s = summary.data;
  const decided = s ? s.approved + s.changes_requested : 0;

  return (
    <div data-canvas="contrast" className="mx-auto w-full max-w-[1400px] space-y-6 pb-8 animate-in fade-in duration-300">
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
            onClick={() => (needsMyReview[0] ? openInScreener(needsMyReview[0].id) : navigate("/compliance/scanner"))}
          >
            {waiting ? "Start reviewing" : "Open Content screener"}
          </Button>
        </div>
      </div>

      {/* At a glance */}
      <section aria-label="Your review queue at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Waiting for you"
          value={loading ? "–" : waiting}
          note={
            soonest?.due_at
              ? `Next due ${format(new Date(soonest.due_at), "EEE, MMM d")}`
              : oldestSent
              ? `Oldest sent ${formatDistanceToNow(oldestSent)} ago`
              : waiting
              ? null
              : "All caught up"
          }
        />
        <StatCard
          label="Overdue"
          value={loading ? "–" : overdue}
          note={overdue ? "Past their review deadline" : "None overdue"}
          noteTone={overdue ? "red" : "green"}
        />
        <StatCard
          label="Failing checks"
          value={loading ? "–" : failing}
          note={failing ? "Red result or score under 60" : "No failing checks"}
          noteTone={failing ? "amber" : "green"}
        />
        <StatCard
          label="Reviewed"
          value={s ? s.reviews_completed : "–"}
          note={s ? `Last 30 days · ${s.approved} approved, ${s.changes_requested} sent back` : null}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: the queue, and how reviewing is going */}
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Needs your review"
            count={loading || !waiting ? undefined : waiting}
            subtitle="Soonest deadline first"
            action={
              <Link to="/compliance/scanner" className="shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                View all
              </Link>
            }
          >
            {loading ? (
              <Loading />
            ) : waiting === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground">Nothing is waiting for your review.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-border/60">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2.5 pl-4 pr-3 font-medium">Post</th>
                      <th className="px-3 py-2.5 font-medium">Audience</th>
                      <th className="px-3 py-2.5 font-medium">Deadline</th>
                      <th className="px-3 py-2.5 font-medium">Compliance</th>
                      <th className="py-2.5 pl-3 pr-4 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((r) => {
                      // Only posts that are late AND failing get the red highlight, so they stand out.
                      const urgent = isOverdue(r) && isFailing(r);
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-border/60 ${urgent ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-500/5 dark:hover:bg-red-500/10" : "hover:bg-muted/30"}`}
                        >
                          <td className="py-3 pl-4 pr-3">
                            <div className="flex items-center gap-3">
                              <Thumb s={r} className="h-10 w-14" />
                              <div className="min-w-0">
                                <Link to={`/submissions/${r.id}`} className="block max-w-[260px] truncate font-medium text-foreground hover:underline">
                                  {r.title}
                                </Link>
                                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                  <Platforms platforms={r.platforms} />
                                  <span>
                                    by {r.created_by_name ?? "Unknown"}
                                    {r.current_version > 1 && ` · v${r.current_version}`}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-foreground whitespace-nowrap">{audienceName(r.audience)}</td>
                          <td className="px-3 py-3 text-xs">
                            <Deadline dueAt={r.due_at} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <Score score={r.latest_score} pending={r.analysis_pending} />
                              {!r.analysis_pending && r.latest_score != null && (
                                <span className="whitespace-nowrap text-xs text-muted-foreground">
                                  {issuesText(r.issue_count)?.replace("to fix", "found") ?? "No issues"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pl-3 pr-4">
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                className="h-8 rounded-lg bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800"
                                onClick={() => openInScreener(r.id)}
                              >
                                Review
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {reviewPages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>
                  Page {reviewPage + 1} of {reviewPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setReviewPage(reviewPage - 1)} disabled={reviewPage === 0} aria-label="Previous page">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setReviewPage(reviewPage + 1)}
                    disabled={reviewPage >= reviewPages - 1}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </Section>

          {/* How reviewing is going: decisions and the issues that keep coming up */}
          <Section title="Review activity" subtitle="Last 30 days, across the content you review">
            {summary.isLoading ? (
              <Loading />
            ) : !s ? (
              <p className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">Couldn't load review activity.</p>
            ) : (
              <div className="grid gap-6 border-t border-border/60 p-4 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">Decisions</span>
                    <span className="text-xs text-muted-foreground">
                      {decided} total{s.average_score != null ? ` · average score ${s.average_score}/100` : ""}
                    </span>
                  </div>
                  {decided === 0 ? (
                    <p className="text-sm text-muted-foreground">No decisions in the last 30 days.</p>
                  ) : (
                    <>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${s.approved} approved, ${s.changes_requested} sent back`}>
                        <span className="bg-emerald-500" style={{ width: `${(s.approved / decided) * 100}%` }} />
                        <span className="bg-amber-500" style={{ width: `${(s.changes_requested / decided) * 100}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved <b className="font-semibold text-foreground">{s.approved}</b>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500" /> Sent back for changes{" "}
                          <b className="font-semibold text-foreground">{s.changes_requested}</b>
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm font-medium text-foreground">Most common issues</span>
                  {s.common_findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rulebook issues found in the last 30 days.</p>
                  ) : (
                    <ol className="flex flex-col gap-1.5">
                      {s.common_findings.slice(0, 4).map((f) => (
                        <li key={f.rule_number} className="flex items-baseline gap-2 text-sm">
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                            {/^\d/.test(f.rule_number) ? `Rule ${f.rule_number}` : f.rule_number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-foreground" title={f.title}>
                            {f.title || "Untitled rule"}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{f.count}×</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
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
