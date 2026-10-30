import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { CalendarDays, CheckCircle2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import {
  ActivityList,
  Empty,
  Loading,
  STATUS_PILL,
  Score,
  Section,
  StatCard,
  Thumb,
  greeting,
  issuesText,
  statusOf,
} from "@/components/dashboard/dashboardParts";
import DayAgenda from "@/components/dashboard/DayAgenda";
import { refetchWhileAnalysing } from "@/components/submissions/submissionUi";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "Due Fri, Oct 30" style text for a resubmission deadline, and whether it's urgent. */
function dueLabel(dueAt?: string | null) {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (isPast(due)) return { text: `Overdue by ${formatDistanceToNow(due)}`, urgent: true };
  if (isToday(due)) return { text: `Due today, ${format(due, "h:mm a")}`, urgent: true };
  if (isTomorrow(due)) return { text: `Due tomorrow, ${format(due, "h:mm a")}`, urgent: false };
  return { text: `Due ${format(due, "EEE, MMM d")}`, urgent: false };
}

const NEXT_STEP_LIMIT = 3;
const RECENT_LIMIT = 5;
const ACTIVITY_LIMIT = 5;

type PostFilter = "all" | "IN_REVIEW" | "APPROVED";
const FILTERS: { v: PostFilter; label: string }[] = [
  { v: "all", label: "All" },
  { v: "IN_REVIEW", label: "In review" },
  { v: "APPROVED", label: "Approved" },
];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One thing waiting on the creator: what it is, what's wrong, when it's due, and one button. */
function NextStepRow({ s, onOpen }: { s: SubmissionSummary; onOpen: () => void }) {
  const changes = s.status === "CHANGES_REQUESTED";
  const status = STATUS_PILL[s.status] ?? { label: s.status, pill: "bg-muted text-muted-foreground" };
  const due = changes ? dueLabel(s.due_kind === "REVISION" ? s.due_at : null) : null;
  const details = changes
    ? [issuesText(s.issue_count) ?? "A reviewer asked for changes"]
    : [!s.caption_text ? "No caption yet" : null, `Last edited ${format(new Date(s.updated_at), "MMM d")}`];
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border/60 px-4 py-3.5">
      <Thumb s={s} className="h-11 w-16 rounded-lg" />
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{s.title}</span>
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${status.pill}`}>{status.label}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {details.filter(Boolean).join(" · ")}
          {due && (
            <span className={due.urgent ? "font-semibold text-red-600 dark:text-red-400" : "font-medium text-foreground"}> · {due.text}</span>
          )}
        </p>
      </div>
      <Button
        onClick={onOpen}
        variant={changes ? "default" : "outline"}
        className={`h-9 shrink-0 rounded-lg px-4 text-sm font-medium ${changes ? "bg-blue-700 text-white hover:bg-blue-800" : ""}`}
      >
        {changes ? "Fix issues" : "Continue draft"}
      </Button>
    </li>
  );
}

function PostRow({ s }: { s: SubmissionSummary }) {
  const status = STATUS_PILL[statusOf(s)] ?? { label: s.status, pill: "bg-muted text-muted-foreground" };
  const platform = s.platforms[0] as SocialPlatform | undefined;
  const where = [
    platform ? PLATFORM_LABELS[platform] ?? platform : null,
    s.account?.handle ? `@${s.account.handle.replace(/^@/, "")}` : s.account?.label,
  ]
    .filter(Boolean)
    .join(" · ");
  const issues = s.analysis_pending ? null : s.issue_count ? issuesText(s.issue_count) : s.latest_score != null ? "No issues" : null;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/30">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-3">
          <Thumb s={s} className="h-9 w-12" />
          <div className="min-w-0">
            <Link to={`/submissions/${s.id}`} className="block max-w-[280px] truncate font-medium text-foreground hover:underline">
              {s.title}
            </Link>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {platform && <PlatformIcon platform={platform} className="w-3 h-3" />}
              {where || "No account set"}
            </span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${status.pill}`}>{status.label}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <Score score={s.latest_score} pending={s.analysis_pending} progress={s.analysis_progress} />
          {issues && <span className="text-xs text-muted-foreground">{issues}</span>}
        </div>
      </td>
      <td className="py-3 pl-3 pr-4 text-right text-sm text-muted-foreground whitespace-nowrap">
        {s.submitted_at ? format(new Date(s.submitted_at), "MMM d") : "–"}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** The content creator's dashboard: what needs them, how their posts are doing, what's coming up, and what reviewers did. */
export default function CreatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const submissions = useQuery({
    queryKey: ["submissions", "mine"],
    queryFn: () => submissionService.list(undefined, "mine"),
    staleTime: 0,
    refetchInterval: refetchWhileAnalysing,
  });
  const summary = useQuery({
    queryKey: ["dashboard-summary", "mine"],
    queryFn: () => submissionService.dashboard("mine"),
    staleTime: 60_000,
  });

  const mine = useMemo(() => (submissions.data ?? []).filter((s) => s.created_by === user?.id), [submissions.data, user?.id]);

  // Changes to make (soonest due first), then drafts (latest first).
  const nextSteps = useMemo(() => {
    const due = (s: SubmissionSummary) => (s.due_at ? new Date(s.due_at).getTime() : Infinity);
    return [
      ...mine.filter((s) => s.status === "CHANGES_REQUESTED").sort((a, b) => due(a) - due(b)),
      ...mine.filter((s) => s.status === "DRAFT").sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    ];
  }, [mine]);

  const changes = mine.filter((s) => s.status === "CHANGES_REQUESTED");
  const inReview = mine.filter((s) => s.status === "IN_REVIEW");
  const scheduled = mine.filter((s) => statusOf(s) === "SCHEDULED").length;
  const oldestInReview = inReview.reduce<Date | null>((oldest, s) => {
    const at = s.submitted_at ? new Date(s.submitted_at) : null;
    return at && (!oldest || at < oldest) ? at : oldest;
  }, null);
  const soonestDue = dueLabel(changes[0]?.due_kind === "REVISION" ? changes[0]?.due_at : null);

  const [filter, setFilter] = useState<PostFilter>("all");
  const sent = useMemo(
    () =>
      mine
        .filter((s) => s.status !== "DRAFT" && s.submitted_at)
        .filter((s) => filter === "all" || s.status === filter)
        .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime()),
    [mine, filter]
  );

  // What reviewers did on their posts; their own actions (sending for review) aren't news to them.
  const activity = (summary.data?.activity ?? []).filter((a) => a.actor_id !== user?.id).slice(0, ACTIVITY_LIMIT);

  const loading = submissions.isLoading;
  const waiting = nextSteps.length;
  const headline = loading
    ? ""
    : waiting === 0
    ? "Nothing is waiting on you right now."
    : `You have ${waiting} thing${waiting === 1 ? "" : "s"} waiting on you.${
        !soonestDue ? "" : soonestDue.text.startsWith("Overdue") ? " One is overdue." : ` One is ${soonestDue.text.replace(/^Due/, "due")}.`
      }`;

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
          <Button asChild className="h-10 gap-2 rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800">
            <Link to="/submissions/new">
              <Plus className="w-4 h-4" /> New post
            </Link>
          </Button>
        </div>
      </div>

      {/* At a glance */}
      <section aria-label="Your posts at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Needs your changes"
          value={loading ? "–" : changes.length}
          note={soonestDue?.text ?? (changes.length ? null : "All clear")}
          noteTone={soonestDue?.urgent ? "red" : soonestDue ? "amber" : "muted"}
        />
        <StatCard
          label="In review"
          value={loading ? "–" : inReview.length}
          note={oldestInReview ? `Oldest waiting ${formatDistanceToNow(oldestInReview)}` : "Nothing waiting"}
        />
        <StatCard
          label="Approved"
          value={summary.data ? summary.data.approved : "–"}
          note={`Last 30 days${scheduled ? ` · ${scheduled} scheduled` : ""}`}
        />
        <StatCard
          label="Average compliance score"
          value={
            summary.data?.average_score != null ? (
              <>
                {summary.data.average_score}
                <span className="text-base font-medium text-muted-foreground"> / 100</span>
              </>
            ) : (
              "–"
            )
          }
          note="Last 30 days"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] min-[112.5rem]:grid-cols-[minmax(0,1fr)_480px]">
        {/* Left: what needs them, and what they've sent */}
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Needs you"
            count={loading || !waiting ? undefined : waiting}
            subtitle="Most urgent first"
            action={
              waiting > NEXT_STEP_LIMIT ? (
                <Link to="/submissions" className="shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  View all {waiting}
                </Link>
              ) : null
            }
          >
            {loading ? (
              <Loading />
            ) : waiting === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">Nothing waiting on you</p>
                <p className="text-xs text-muted-foreground">No changes requested and no drafts. Create a post when you're ready.</p>
              </div>
            ) : (
              <ul>
                {nextSteps.slice(0, NEXT_STEP_LIMIT).map((s) => (
                  <NextStepRow key={s.id} s={s} onOpen={() => navigate(`/submissions/new?id=${s.id}`)} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Recent posts"
            subtitle="What you've sent for review"
            action={
              <div role="tablist" aria-label="Filter posts" className="flex shrink-0 rounded-lg bg-muted p-0.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.v}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.v}
                    onClick={() => setFilter(f.v)}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                      filter === f.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          >
            {loading ? (
              <Loading />
            ) : sent.length === 0 ? (
              <Empty>{filter === "all" ? "Posts you send for review will show here." : "No posts here yet."}</Empty>
            ) : (
              <>
                <div className="overflow-x-auto border-t border-border/60">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2.5 pl-4 pr-3 font-medium">Post</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Compliance</th>
                        <th className="py-2.5 pl-3 pr-4 text-right font-medium">Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sent.slice(0, RECENT_LIMIT).map((s) => (
                        <PostRow key={s.id} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end border-t border-border/60 px-4 py-2.5">
                  <Link to="/submissions" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    View all your posts →
                  </Link>
                </div>
              </>
            )}
          </Section>
        </div>

        {/* Right: the day's schedule, and what reviewers did */}
        <div className="flex min-w-0 flex-col gap-6">
          <DayAgenda posts={mine} loading={loading} />

          <Section title="Activity" subtitle="What reviewers did on your posts">
            <ActivityList items={activity} loading={summary.isLoading} empty="No reviewer activity on your posts yet." />
          </Section>
        </div>
      </div>
    </div>
  );
}
