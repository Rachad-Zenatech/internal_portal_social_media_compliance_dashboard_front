import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import NotificationsPanel from "@/components/dashboard/NotificationsPanel";
import WeekAhead from "@/components/dashboard/WeekAhead";
import PipelineSection, { type PipelineStage } from "@/components/dashboard/PipelineSection";
import {
  Deadline,
  Loading,
  Platforms,
  RowMenu,
  Score,
  Section,
  Thumb,
  statusOf,
  viewAll,
} from "@/components/dashboard/dashboardParts";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Reviewers get the reviewer's dashboard; creators (and super admins viewing the app as a creator) their own. */
const REVIEW_PAGE_SIZE = 5;

// The stages a reviewer tracks, coloured like their status pills.
const REVIEW_STAGES: PipelineStage[] = [
  { key: "IN_REVIEW", label: "In review", bar: "bg-blue-500", to: "/compliance/scanner" },
  { key: "SCHEDULED", label: "Scheduled", bar: "bg-violet-500", to: "/content-calendar" },
  { key: "APPROVED", label: "Approved", bar: "bg-emerald-500", to: "/compliance/scanner" },
];

export default function Dashboard() {
  const { hasPermission } = useAuth();
  return hasPermission("CONTENT_REVIEW_APPROVE") ? <ReviewerDashboard /> : <CreatorDashboard />;
}

function ReviewerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setActiveVideoId } = useVideoUploadQueue();
  // Reviewers see everyone's content on their brands, as in the Content Screener.
  const scope = "all";

  const submissions = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    staleTime: 0,
  });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions });

  const brandName = (code?: string | null) => (code ? options.data?.brands.find((b) => b.code === code)?.name ?? code : "Not set");

  const all = useMemo(() => submissions.data ?? [], [submissions.data]);
  const now = useMemo(() => new Date(), []);
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
  const openInScreener = (id: string) => {
    setActiveVideoId(`sub-${id}`);
    navigate("/compliance/scanner");
  };


  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const loading = submissions.isLoading;
  // The review list shows five at a time; reviewed posts drop out, so keep the page in range.
  const [rawReviewPage, setReviewPage] = useState(0);
  const reviewPages = Math.max(1, Math.ceil(needsMyReview.length / REVIEW_PAGE_SIZE));
  const reviewPage = Math.min(rawReviewPage, reviewPages - 1);
  const reviewRows = needsMyReview.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE);
  const pipeline = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of all) counts[statusOf(s)] = (counts[statusOf(s)] ?? 0) + 1;
    return counts;
  }, [all]);
  const pipelineTotal = REVIEW_STAGES.reduce((sum, st) => sum + (pipeline[st.key] ?? 0), 0);
  // One plain sentence about the queue.

  return (
    <div data-canvas="contrast" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Welcome: what's waiting, and a quick way into the queue */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_oklch(0_0_0/0.05)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Review desk
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
              {greeting}
              {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
              !
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-11 rounded-xl px-5 gap-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-sm"
              onClick={() => (needsMyReview[0] ? openInScreener(needsMyReview[0].id) : navigate("/compliance/scanner"))}
            >
              {needsMyReview.length ? "Start reviewing" : "Open Content Screener"}
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl px-4 gap-2 text-sm font-semibold bg-card/80">
              <Link to="/content-calendar">
                <CalendarDays className="w-4 h-4" /> Calendar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        {/* What's waiting for their decision */}
        <Section
          title="Needs Your Review"
          count={loading ? undefined : needsMyReview.length}
          subtitle="Soonest deadline first"
          action={viewAll("/compliance/scanner")}
        >
          {loading ? (
            <Loading />
          ) : needsMyReview.length === 0 ? (
            <div className="border-t border-border/60 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground">Nothing is waiting for your review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-y border-border/60 bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pl-4 font-semibold">Content</th>
                    <th className="py-2.5 font-semibold">Platform</th>
                    <th className="py-2.5 font-semibold">Brand</th>
                    <th className="py-2.5 font-semibold">Submitted</th>
                    <th className="py-2.5 font-semibold">Deadline</th>
                    <th className="py-2.5 font-semibold">Compliance</th>
                    <th className="py-2.5 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {reviewRows.map((r) => {
                    const submitted = r.submitted_at ? new Date(r.submitted_at) : null;
                    const overdue = Boolean(r.due_at && isPast(new Date(r.due_at)));
                    return (
                      <tr key={r.id} className={overdue ? "bg-red-50/50 hover:bg-red-50 dark:bg-red-500/5 dark:hover:bg-red-500/10" : "hover:bg-muted/30"}>
                        <td className={`py-3 pl-3 pr-3 border-l-4 ${overdue ? "border-l-red-500" : "border-l-transparent"}`}>
                          <div className="flex items-center gap-3">
                            <Thumb s={r} className="h-12 w-[72px]" />
                            <span className="min-w-0">
                              <span className="block max-w-[200px] font-semibold leading-snug text-foreground line-clamp-2">{r.title}</span>
                              <span className="block font-mono text-[11px] text-muted-foreground">
                                {r.reference_code}
                                {r.current_version > 1 && ` · v${r.current_version}`}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Platforms platforms={r.platforms} />
                        </td>
                        <td className="py-3 pr-3 text-xs text-foreground">{brandName(r.brand_code)}</td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {submitted ? (
                            <>
                              {format(submitted, "MMM d")}
                              <br />
                              {format(submitted, "h:mm a")}
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="py-3 pr-3 text-xs">
                          <Deadline dueAt={r.due_at} />
                        </td>
                        <td className="py-3 pr-3">
                          <Score score={r.latest_score} pending={r.analysis_pending} />
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800"
                              onClick={() => openInScreener(r.id)}
                            >
                              Review
                            </Button>
                            <RowMenu id={r.id} />
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
            <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              <span>
                Page {reviewPage + 1} of {reviewPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setReviewPage(reviewPage - 1)}
                  disabled={reviewPage === 0}
                  aria-label="Previous page"
                >
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

        <div className="space-y-5 min-w-0">
          <NotificationsPanel pageSize={4} />

          {/* Every post on the platform past review, by stage */}
          <PipelineSection
            stages={REVIEW_STAGES}
            counts={pipeline}
            total={pipelineTotal}
            loading={loading}
            subtitle="All posts across the platform, by stage"
          />
        </div>
      </div>

      {/* The week ahead */}
      <WeekAhead posts={all} loading={loading} />
    </div>
  );
}
