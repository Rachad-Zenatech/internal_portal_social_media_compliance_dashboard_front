import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import {
  AlarmClock,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  MessageSquareWarning,
  ScanEye,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import CreatorDashboard from "@/components/dashboard/CreatorDashboard";
import {
  ACTIVITY_STYLE,
  Deadline,
  Empty,
  Loading,
  Platforms,
  RowMenu,
  STATUS_PILL,
  Score,
  ScoreRing,
  Section,
  SectionIcon,
  StatCard,
  TONE,
  Thumb,
  UPCOMING_DAYS,
  type Tone,
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
  const summary = useQuery({
    queryKey: ["submissions-dashboard", scope],
    queryFn: () => submissionService.dashboard(scope),
    staleTime: 30_000,
  });

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
  const upcoming = useMemo(() => {
    const end = addDays(now, UPCOMING_DAYS);
    return all
      .filter((s) => s.publish_at && s.status !== "REJECTED" && new Date(s.publish_at) >= now && new Date(s.publish_at) <= end)
      .sort((a, b) => new Date(a.publish_at!).getTime() - new Date(b.publish_at!).getTime());
  }, [all, now]);
  const counts = {
    needsMyReview: needsMyReview.length,
    overdue: needsMyReview.filter((s) => s.due_at && isPast(new Date(s.due_at))).length,
    inReview: all.filter((s) => s.status === "IN_REVIEW").length,
    approved: all.filter((s) => statusOf(s) === "SCHEDULED" || (s.status === "APPROVED" && !s.publish_at)).length,
    upcoming: upcoming.filter((s) => statusOf(s) === "SCHEDULED").length,
  };

  // One card per count, in the same stage colours as the creator's dashboard.
  const tiles: { value: number; label: string; hint: string; to: string; Icon: typeof ClipboardCheck; tone: Tone; attention?: boolean }[] = [
    {
      value: counts.needsMyReview,
      label: "Needs my review",
      hint: "Waiting for your decision",
      to: "/compliance/scanner",
      Icon: ClipboardCheck,
      tone: "amber",
      attention: counts.needsMyReview > 0,
    },
    {
      value: counts.overdue,
      label: "Overdue",
      hint: "Past the review deadline",
      to: "/compliance/scanner",
      Icon: AlarmClock,
      tone: "red",
      attention: counts.overdue > 0,
    },
    { value: counts.inReview, label: "In review", hint: "With any reviewer", to: "/compliance/scanner", Icon: Hourglass, tone: "blue" },
    { value: counts.approved, label: "Approved", hint: "Ready to schedule or post", to: "/compliance/scanner", Icon: CheckCircle2, tone: "emerald" },
    {
      value: counts.upcoming,
      label: "Upcoming posts",
      hint: `Scheduled, next ${UPCOMING_DAYS} days`,
      to: "/content-calendar",
      Icon: CalendarCheck,
      tone: "violet",
    },
  ];

  const openInScreener = (id: string) => {
    setActiveVideoId(`sub-${id}`);
    navigate("/compliance/scanner");
  };

  const s = summary.data;
  const insights: { value: number | string; label: string; Icon: typeof ClipboardCheck; tone: Tone }[] = [
    { value: s ? s.reviews_completed : "–", label: "Reviews completed", Icon: ClipboardCheck, tone: "blue" },
    { value: s ? s.approved : "–", label: "Approved", Icon: CheckCircle2, tone: "emerald" },
    { value: s ? s.changes_requested : "–", label: "Changes requested", Icon: MessageSquareWarning, tone: "amber" },
    { value: s ? s.overdue_reviews : "–", label: "Overdue now", Icon: AlarmClock, tone: s?.overdue_reviews ? "red" : "slate" },
  ];
  const topFlagCount = Math.max(1, ...(s?.common_findings ?? []).map((f) => f.count));

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const loading = submissions.isLoading;
  // One plain sentence about the queue.
  const headline = loading
    ? "Loading your review queue..."
    : counts.needsMyReview
    ? `${counts.needsMyReview} post${counts.needsMyReview === 1 ? " is" : "s are"} waiting for your decision${
        counts.overdue ? `, and ${counts.overdue} ${counts.overdue === 1 ? "is" : "are"} past the deadline` : ""
      }.`
    : `Your review queue is clear.${
        counts.upcoming ? ` ${counts.upcoming} post${counts.upcoming === 1 ? " goes" : "s go"} out in the next ${UPCOMING_DAYS} days.` : ""
      }`;

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Welcome: what's waiting, and a quick way into the queue */}
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-5 sm:p-6 dark:border-blue-500/20 dark:from-blue-500/10 dark:via-card dark:to-emerald-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <ShieldCheck className="w-3.5 h-3.5" /> Review desk
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {greeting}
              {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-11 rounded-xl px-5 gap-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-sm"
              onClick={() => (needsMyReview[0] ? openInScreener(needsMyReview[0].id) : navigate("/compliance/scanner"))}
            >
              <ScanEye className="w-4 h-4" /> {needsMyReview.length ? "Start reviewing" : "Open Content Screener"}
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl px-4 gap-2 text-sm font-semibold bg-card/80">
              <Link to="/content-calendar">
                <CalendarDays className="w-4 h-4" /> Calendar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Counts: one card each, opening its page */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <StatCard key={tile.label} {...tile} value={loading ? "–" : tile.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
        {/* What's waiting for their decision */}
        <Section
          title="Needs Your Review"
          count={loading ? undefined : needsMyReview.length}
          subtitle="Soonest deadline first"
          icon={<SectionIcon Icon={ClipboardCheck} tone="amber" />}
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
                  {needsMyReview.map((r) => {
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
                          <Score score={r.latest_score} />
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 rounded-lg bg-blue-700 px-3.5 text-xs font-semibold text-white hover:bg-blue-800"
                              onClick={() => openInScreener(r.id)}
                            >
                              <ScanEye className="w-3.5 h-3.5" /> Review
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
        </Section>

        {/* Upcoming content */}
        <Section
          title="Upcoming Content"
          count={loading ? undefined : upcoming.length}
          subtitle={`Planned for the next ${UPCOMING_DAYS} days`}
          icon={<SectionIcon Icon={CalendarDays} tone="violet" />}
          action={viewAll("/content-calendar")}
        >
          {loading ? (
            <Loading />
          ) : upcoming.length === 0 ? (
            <Empty>Nothing is planned for the next {UPCOMING_DAYS} days.</Empty>
          ) : (
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {upcoming.map((u) => {
                const day = new Date(u.publish_at!);
                const status = STATUS_PILL[statusOf(u)] ?? { label: u.status, pill: "bg-muted text-muted-foreground" };
                return (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`w-11 shrink-0 rounded-lg py-1 text-center ${
                        isToday(day) ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "bg-muted/60 text-foreground"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{format(day, "MMM")}</p>
                      <p className="text-lg font-semibold leading-none tabular-nums">{format(day, "d")}</p>
                    </div>
                    <Thumb s={u} className="h-12 w-12" />
                    <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                      <Link to={`/submissions/${u.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                        {u.title}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1 truncate">
                        <Platforms platforms={u.platforms} />
                        <span>· {brandName(u.brand_code)}</span>
                      </p>
                      <p>
                        {isToday(day) ? "Today" : isTomorrow(day) ? "Tomorrow" : format(day, "EEE MMM d")}, {format(day, "h:mm a")}
                      </p>
                    </div>
                    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.pill}`}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* Recent activity, each kind with its own icon and colour */}
        <Section
          title="Recent Activity"
          subtitle="Latest updates across your content"
          icon={<SectionIcon Icon={TrendingUp} tone="blue" />}
          action={viewAll("/compliance/scanner")}
        >
          {summary.isLoading ? (
            <Loading />
          ) : !s?.activity.length ? (
            <Empty>No activity yet.</Empty>
          ) : (
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {s.activity.map((a, i) => {
                const you = Boolean(user?.id && a.actor_id === user.id);
                const name = you ? "You" : a.actor_name || "Someone";
                const style = ACTIVITY_STYLE[a.action] ?? { Icon: Sparkles, tone: "bg-muted text-muted-foreground" };
                return (
                  <li key={`${a.submission_id}-${a.at}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.tone}`}>
                      <style.Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        <span className="font-semibold">{name}</span> {a.action}{" "}
                        <Link to={`/submissions/${a.submission_id}`} className="font-mono text-xs text-blue-700 hover:underline dark:text-blue-300">
                          {a.reference_code}
                        </Link>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground" title={format(new Date(a.at), "MMM d, h:mm a")}>
                      {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Compliance insights */}
        <Section
          title="Compliance Insights"
          subtitle={`Last ${s?.days ?? 30} days`}
          icon={<SectionIcon Icon={ShieldCheck} tone="emerald" />}
          action={viewAll("/compliance/rules", "Rulebook")}
        >
          <div className="grid gap-4 border-t border-border/60 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <ScoreRing score={s?.average_score} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Average compliance score</p>
              <p className="mb-3 text-xs text-muted-foreground">Across content sent for review in this period.</p>
              <div className="grid grid-cols-2 gap-2">
                {insights.map((i) => (
                  <div key={i.label} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${TONE[i.tone]}`}>
                      <i.Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-semibold leading-tight tabular-nums text-foreground">{i.value}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{i.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 px-4 py-3.5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Most flagged rules</p>
            {summary.isLoading ? (
              <p className="py-2 text-xs text-muted-foreground">Loading...</p>
            ) : !s?.common_findings.length ? (
              <p className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No rulebook flags on content sent for review in this period.
              </p>
            ) : (
              <ul className="space-y-2.5 pt-1">
                {s.common_findings.map((f) => (
                  <li key={f.rule_number} className="text-sm" title={`${f.count} flag${f.count === 1 ? "" : "s"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-foreground">
                        <span className="font-semibold">{f.rule_number}</span> · {f.title}
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">{f.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(f.count / topFlagCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Flags raised by the automated check on content sent for review.</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
