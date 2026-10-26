import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow, isPast, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FilePen,
  Hourglass,
  MessageCircle,
  MessageSquareWarning,
  Plus,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACTIVITY_STYLE,
  Empty,
  Loading,
  Platforms,
  QUICK_CREATE,
  STATUS_PILL,
  Score,
  ScoreRing,
  Section,
  Thumb,
  UPCOMING_DAYS,
  statusOf,
  viewAll,
} from "@/components/dashboard/dashboardParts";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// What the creator's dashboard shows, in their own words and colours
// ---------------------------------------------------------------------------

// Stage colours match the Content Portal's status pills: one fixed colour per stage everywhere.
const STAGES: { key: string; label: string; Icon: LucideIcon; card: string; icon: string; bar: string }[] = [
  {
    key: "CHANGES_REQUESTED",
    label: "Needs your changes",
    Icon: MessageSquareWarning,
    card: "border-amber-200 dark:border-amber-500/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  {
    key: "DRAFT",
    label: "Drafts",
    Icon: FilePen,
    card: "border-border/70",
    icon: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  {
    key: "IN_REVIEW",
    label: "In review",
    Icon: Hourglass,
    card: "border-border/70",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  {
    key: "SCHEDULED",
    label: "Scheduled",
    Icon: CalendarCheck,
    card: "border-border/70",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500",
  },
  {
    key: "APPROVED",
    label: "Approved",
    Icon: CheckCircle2,
    card: "border-border/70",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
];

const BEFORE_YOU_SUBMIT = [
  "The caption says exactly what the post shows, with no stronger claims than the facts support.",
  "Estimates or plans are marked as preliminary, with the safe-harbor wording where needed.",
  "Images are yours to use, and nothing in them was edited to change what happened.",
  "Drones and products are described by their real stage: in testing, piloted, or available.",
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

/** One thing to do next: a post sent back for changes, or a draft to finish. */
function NextStepCard({ s, onOpen }: { s: SubmissionSummary; onOpen: () => void }) {
  const changes = s.status === "CHANGES_REQUESTED";
  const due = changes ? dueLabel(s.due_kind === "REVISION" ? s.due_at : null) : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border-l-4 bg-card px-3 py-2.5 shadow-xs ring-1 ring-border/60 ${
        changes ? "border-l-amber-500" : "border-l-slate-300 dark:border-l-slate-600"
      }`}
    >
      <Thumb s={s} className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {changes ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
              <MessageSquareWarning className="w-3.5 h-3.5" /> Changes requested
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
              <FilePen className="w-3.5 h-3.5" /> Draft · edited {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}
            </span>
          )}
          {due && <span className={due.urgent ? "font-semibold text-red-600 dark:text-red-400" : ""}>{due.text}</span>}
          {s.comment_count ? (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> {s.comment_count}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 flex items-center gap-2">
          <Platforms platforms={s.platforms} />
          {s.latest_score != null && <Score score={s.latest_score} />}
        </p>
      </div>
      <Button
        size="sm"
        onClick={onOpen}
        className={`h-8 shrink-0 gap-1 rounded-lg px-3 text-xs font-semibold text-white ${
          changes ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-700 hover:bg-blue-800"
        }`}
      >
        {changes ? "Make changes" : "Continue"} <ArrowRight className="w-3.5 h-3.5" />
      </Button>
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
  const summary = useQuery({
    queryKey: ["submissions-dashboard", "mine"],
    queryFn: () => submissionService.dashboard("mine"),
    staleTime: 30_000,
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
  const inReview = useMemo(
    () => mine.filter((s) => s.status === "IN_REVIEW").sort((a, b) => new Date(a.submitted_at ?? a.created_at).getTime() - new Date(b.submitted_at ?? b.created_at).getTime()),
    [mine]
  );
  const week = useMemo(() => {
    const start = startOfDay(now);
    return Array.from({ length: UPCOMING_DAYS }, (_, i) => {
      const day = addDays(start, i);
      const posts = mine
        .filter((s) => s.publish_at && s.status !== "REJECTED" && isSameDay(new Date(s.publish_at), day))
        .sort((a, b) => new Date(a.publish_at!).getTime() - new Date(b.publish_at!).getTime());
      return { day, posts };
    });
  }, [mine, now]);
  const weekPosts = week.flatMap((d) => d.posts);

  const changesCount = byStage.CHANGES_REQUESTED ?? 0;
  const draftCount = byStage.DRAFT ?? 0;
  const loading = submissions.isLoading;
  const s = summary.data;

  // One plain sentence about what needs them today.
  const headline = loading
    ? "Loading your content..."
    : changesCount
    ? `${changesCount} post${changesCount === 1 ? " needs" : "s need"} your changes${draftCount ? `, and ${draftCount} draft${draftCount === 1 ? " is" : "s are"} waiting to be sent` : ""}.`
    : draftCount
    ? `You have ${draftCount} draft${draftCount === 1 ? "" : "s"} ready to finish and send for review.`
    : inReview.length
    ? `You're all caught up. ${inReview.length} post${inReview.length === 1 ? " is" : "s are"} with a reviewer.`
    : "You're all caught up. Start something new?";

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Welcome: what needs them, and a quick way to start */}
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-5 sm:p-6 dark:border-blue-500/20 dark:from-blue-500/10 dark:via-card dark:to-violet-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <Sparkles className="w-3.5 h-3.5" /> Your content
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {greeting(now)}
              {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
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

      {/* Where their posts are, one coloured card per stage */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((st) => {
          const n = byStage[st.key] ?? 0;
          const attention = st.key === "CHANGES_REQUESTED" && n > 0;
          return (
            <Link
              key={st.key}
              to={st.key === "SCHEDULED" ? "/content-calendar" : "/submissions"}
              className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm ${attention ? st.card : "border-border/70"}`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${st.icon}`}>
                <st.Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className={`block text-2xl font-semibold tabular-nums ${attention ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>
                  {loading ? "–" : n}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{st.label}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* What to do next */}
          <Section
            title="Your Next Steps"
            count={loading ? undefined : nextSteps.length}
            subtitle="Posts sent back for changes come first, then your drafts"
            icon={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <ClipboardCheck className="w-4 h-4" />
              </span>
            }
            action={viewAll("/submissions")}
          >
            {loading ? (
              <Loading />
            ) : nextSteps.length === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">Nothing waiting on you</p>
                <p className="text-xs text-muted-foreground">No changes requested and no drafts. Create a post when you're ready.</p>
              </div>
            ) : (
              <ul className="space-y-2 border-t border-border/60 bg-muted/20 p-3">
                {nextSteps.slice(0, 6).map((step) => (
                  <NextStepCard key={step.id} s={step} onOpen={() => navigate(`/submissions/new?id=${step.id}`)} />
                ))}
                {nextSteps.length > 6 && (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    and {nextSteps.length - 6} more in {viewAll("/submissions", "Upload Content")}
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* With a reviewer */}
          <Section
            title="Waiting on Review"
            count={loading ? undefined : inReview.length}
            subtitle="With a reviewer now; you'll get a notification when they decide"
            icon={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                <Hourglass className="w-4 h-4" />
              </span>
            }
          >
            {loading ? (
              <Loading />
            ) : inReview.length === 0 ? (
              <Empty>Nothing of yours is in review right now.</Empty>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {inReview.map((r) => {
                  const due = dueLabel(r.due_kind === "REVIEW" ? r.due_at : null, "Decision due");
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Thumb s={r} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/submissions/${r.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                          {r.title}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          Sent {r.submitted_at ? formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true }) : "recently"}
                          {r.current_version > 1 && ` · version ${r.current_version}`}
                          {due && ` · ${due.text.replace("Decision due by", "decision due")}`}
                        </p>
                      </div>
                      <Score score={r.latest_score} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5 min-w-0">
          {/* The week ahead */}
          <Section
            title="This Week"
            count={loading ? undefined : weekPosts.length}
            subtitle={`Your posts planned for the next ${UPCOMING_DAYS} days`}
            icon={
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                <CalendarDays className="w-4 h-4" />
              </span>
            }
            action={viewAll("/content-calendar", "Calendar")}
          >
            <div className="grid grid-cols-7 gap-1 border-t border-border/60 px-3 pt-3">
              {week.map(({ day, posts }) => (
                <div
                  key={day.toISOString()}
                  title={posts.length ? posts.map((p) => p.title).join("\n") : "Nothing planned"}
                  className={`rounded-lg px-1 py-2 text-center ${isToday(day) ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30" : ""}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(day, "EEE")}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">{format(day, "d")}</p>
                  <div className="mt-1 flex min-h-2 justify-center gap-0.5">
                    {posts.slice(0, 3).map((p) => (
                      <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${statusOf(p) === "SCHEDULED" ? "bg-violet-500" : "bg-slate-300"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {loading ? (
              <Loading />
            ) : weekPosts.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-muted-foreground">Nothing planned this week.</p>
            ) : (
              <ul className="space-y-1.5 p-3">
                {weekPosts.map((p) => {
                  const at = new Date(p.publish_at!);
                  const status = STATUS_PILL[statusOf(p)] ?? { label: p.status, pill: "bg-muted text-muted-foreground" };
                  return (
                    <li key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                      <span className="w-16 shrink-0 text-[11px] font-semibold text-muted-foreground">
                        {isToday(at) ? "Today" : isTomorrow(at) ? "Tomorrow" : format(at, "EEE")}
                        <span className="block font-normal">{format(at, "h:mm a")}</span>
                      </span>
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

          {/* Where everything is, as one bar */}
          <Section title="Your Content Pipeline" count={loading ? undefined : mine.length} subtitle="Every post of yours, by stage">
            <div className="space-y-3 border-t border-border/60 px-4 py-4">
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : mine.length === 0 ? (
                <p className="text-xs text-muted-foreground">Your posts will show here once you create some.</p>
              ) : (
                <>
                  <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Posts by stage">
                    {STAGES.filter((st) => byStage[st.key]).map((st) => (
                      <span
                        key={st.key}
                        title={`${st.label}: ${byStage[st.key]}`}
                        className={`${st.bar} h-full first:rounded-l-full last:rounded-r-full`}
                        style={{ width: `${(byStage[st.key] / mine.length) * 100}%` }}
                      />
                    ))}
                  </div>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    {STAGES.map((st) => (
                      <li key={st.key} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className={`h-2.5 w-2.5 rounded-sm ${st.bar}`} /> {st.label}
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">{byStage[st.key] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Section>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* What happened to their posts */}
        <Section
          title="Updates on Your Posts"
          subtitle="Decisions, comments and changes, newest first"
          icon={
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <MessageCircle className="w-4 h-4" />
            </span>
          }
          action={viewAll("/submissions")}
        >
          {summary.isLoading ? (
            <Loading />
          ) : !s?.activity.length ? (
            <Empty>No updates yet. They'll appear here as reviewers work on your posts.</Empty>
          ) : (
            <ul className="divide-y divide-border/60 border-t border-border/60">
              {s.activity.map((a, i) => {
                const style = ACTIVITY_STYLE[a.action] ?? { Icon: Sparkles, tone: "bg-muted text-muted-foreground" };
                const who = user?.id && a.actor_id === user.id ? "You" : a.actor_name || "Someone";
                return (
                  <li key={`${a.submission_id}-${a.at}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.tone}`}>
                      <style.Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        <span className="font-semibold">{who}</span> {a.action}{" "}
                        <Link to={`/submissions/${a.submission_id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                          {a.title}
                        </Link>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{a.reference_code}</p>
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

        {/* How their posts are doing on the rulebook */}
        <Section
          title="Your Compliance"
          subtitle={`Last ${s?.days ?? 30} days`}
          icon={
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </span>
          }
        >
          <div className="grid gap-4 border-t border-border/60 p-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-4">
              <ScoreRing score={s?.average_score} />
              <div className="space-y-1 text-xs sm:hidden">
                <p className="font-semibold text-foreground">Average rulebook score</p>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">Average rulebook score</p>
              <p className="text-xs text-muted-foreground">
                {s?.average_score == null
                  ? "Send a post for review to see how it scores against the rulebook."
                  : s.average_score >= 80
                  ? "Great work: your posts are clearing the rulebook."
                  : "Some of your posts are getting flagged. The rules below come up most."}
              </p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">{s?.reviews_completed ?? 0} reviewed</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {s?.approved ?? 0} approved
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {s?.changes_requested ?? 0} sent back
                </span>
              </div>
            </div>
          </div>
          {s?.common_findings.length ? (
            <div className="border-t border-border/60 px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Flagged most on your posts</p>
              <ul className="divide-y divide-border/60">
                {s.common_findings.map((f) => (
                  <li key={f.rule_number} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-foreground">
                      <span className="font-semibold">{f.rule_number}</span> · {f.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {f.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before you submit</p>
            <ul className="space-y-1.5">
              {BEFORE_YOU_SUBMIT.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-xs text-foreground/90">
                  <CheckCircle2 className="mt-px w-3.5 h-3.5 shrink-0 text-emerald-500" /> {tip}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>
    </div>
  );
}
