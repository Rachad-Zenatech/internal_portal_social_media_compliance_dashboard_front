import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { CalendarDays, CheckCircle2, FileStack, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import BulkScriptDialog from "@/components/script/BulkScriptDialog";
import {
  ActivityList,
  Empty,
  Loading,
  scriptNeedsChanges,
  statusPillOf,
  Score,
  Section,
  Thumb,
  greeting,
  issuesText,
  statusOf,
} from "@/components/dashboard/dashboardParts";
import CreatorStats, { type PostFilter } from "@/components/dashboard/CreatorStats";
import DayAgenda from "@/components/dashboard/DayAgenda";
import ReviewSlideshow from "@/components/dashboard/ReviewSlideshow";
import PostSteps from "@/components/submissions/PostSteps";
import { POST_STEPS, ranOnce, stepPath } from "@/lib/postSteps";
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

const RECENT_LIMIT = 5;
const ACTIVITY_LIMIT = 5;

const FILTERS: { v: PostFilter; label: string }[] = [
  { v: "all", label: "All" },
  { v: "IN_REVIEW", label: "In review" },
  { v: "APPROVED", label: "Approved" },
];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** One thing waiting on the creator: what it is, what's wrong, when it's due, and one button. */
/** A reviewer asked for changes to the post, or sent its script back (with or without edits). */
const needsChanges = (s: SubmissionSummary) => s.status === "CHANGES_REQUESTED" || scriptNeedsChanges(s);
/** The script is approved and the video is the creator's next step. */
const awaitingVideo = (s: SubmissionSummary) => s.status === "DRAFT" && s.script_status === "APPROVED";

/** A post that's still a draft, but whose script has been sent to a reviewer. */
const scriptSent = (s: SubmissionSummary) =>
  s.status === "DRAFT" && ["IN_REVIEW", "EDITS_PROPOSED", "CHANGES_REQUESTED", "APPROVED"].includes(s.script_status ?? "");
/** When it went to a reviewer: the post's submission, or (for a script) when it was last worked on. */
const sentAt = (s: SubmissionSummary) => new Date((s.submitted_at ?? s.updated_at) as string);

/** One thing waiting on the creator, as a slide: its picture with the deadline on it, what to do and why, how far
 * along its steps are, and one button. Overdue changes have a red edge; everything else is plain. */
function NextStepCard({ s, onOpen, onOpenStep }: { s: SubmissionSummary; onOpen: () => void; onOpenStep: (step: string) => void }) {
  const scriptChanges = scriptNeedsChanges(s);
  const changes = s.status === "CHANGES_REQUESTED" || scriptChanges;
  const video = !changes && s.script_status === "APPROVED";
  // Changes to make (a post or its script) or an approved script waiting for its video: when it's due.
  const due = (changes && s.due_kind === "REVISION") || (video && s.due_kind === "VIDEO") ? dueLabel(s.due_at) : null;
  const overdue = Boolean(due?.urgent && changes);
  const kind = scriptChanges
    ? s.script_status === "EDITS_PROPOSED"
      ? "Script edited by your reviewer"
      : "Script changes requested"
    : changes
    ? "Changes requested"
    : video
    ? "Script approved · film next"
    : "Draft in progress";
  const details = scriptChanges
    ? "Read the reviewer's changes and accept or edit them."
    : changes
    ? issuesText(s.issue_count) ?? "A reviewer asked for changes."
    : video
    ? "Upload the video; it's checked against the approved script."
    : [!s.caption_text ? "No caption yet" : null, `Last edited ${format(new Date(s.updated_at), "MMM d")}`].filter(Boolean).join(" · ");
  const steps = s.steps && !scriptChanges ? ranOnce(s.steps) : null;
  const stepsDone = steps ? POST_STEPS.filter((p) => steps[p.key] === "done").length : 0;
  const act = changes || video;
  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md ${
        overdue ? "border-red-300 ring-1 ring-red-200 dark:border-red-500/50 dark:ring-red-500/30" : "border-border/70"
      }`}
    >
      <button type="button" onClick={onOpen} aria-label={`Open ${s.title}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-muted">
        <Thumb s={s} className="h-full w-full rounded-none transition-transform duration-300 group-hover:scale-[1.03]" />
        {due && (
          <span
            className={`absolute left-2 top-2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${
              overdue ? "bg-red-600 text-white" : "bg-card text-foreground"
            }`}
          >
            {due.text}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${overdue ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"}`}>{kind}</p>
          <p className="mt-0.5 line-clamp-2 font-semibold leading-snug text-foreground" title={s.title}>
            {s.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{details}</p>
        </div>
        {steps && !steps.locked && (
          <div className="flex items-center gap-2">
            <PostSteps steps={steps} onOpen={onOpenStep} />
            <span className="text-[11px] text-muted-foreground">
              {stepsDone} of {POST_STEPS.length}
            </span>
          </div>
        )}
        <div className="mt-auto border-t border-border/60 pt-2.5">
          <Button
            onClick={onOpen}
            variant={act ? "default" : "outline"}
            className={`h-8 w-full rounded-lg text-xs font-semibold ${act ? "bg-blue-700 text-white hover:bg-blue-800" : ""}`}
          >
            {scriptChanges ? "Review changes" : changes ? "Fix issues" : video ? "Upload video" : "Continue draft"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function PostRow({ s }: { s: SubmissionSummary }) {
  const status = statusPillOf(s);
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
          <Score score={s.latest_score} pending={s.analysis_pending} progress={s.analysis_progress} unavailable={s.ai_unavailable} calculating={s.script_send_status === "PROCESSING"} />
          {issues && <span className="text-xs text-muted-foreground">{issues}</span>}
        </div>
      </td>
      <td className="py-3 pl-3 pr-4 text-right text-sm text-muted-foreground whitespace-nowrap">
        {s.submitted_at || scriptSent(s) ? format(sentAt(s), "MMM d") : "–"}
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
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

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
      ...mine.filter((s) => needsChanges(s) || awaitingVideo(s)).sort((a, b) => due(a) - due(b)),
      // A draft whose script is already with a reviewer is waiting on them, not on the creator.
      ...mine.filter((s) => s.status === "DRAFT" && s.script_status !== "IN_REVIEW" && !awaitingVideo(s)).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    ];
  }, [mine]);

  // Changes to make on the post, or on its script after a reviewer looked at it.
  const changes = mine.filter(needsChanges);
  // What to act on now: changes to make, and approved scripts waiting for their video. Soonest due first.
  const actions = mine
    .filter((s) => needsChanges(s) || awaitingVideo(s))
    .sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity));
  // With a reviewer: the post, or a script sent for review (a draft until it's approved).
  const inReview = mine.filter((s) => s.status === "IN_REVIEW" || (s.status === "DRAFT" && s.script_status === "IN_REVIEW"));
  const scheduled = mine.filter((s) => statusOf(s) === "SCHEDULED").length;
  const oldestInReview = inReview.reduce<Date | null>((oldest, s) => {
    const at = s.submitted_at ? new Date(s.submitted_at) : null;
    return at && (!oldest || at < oldest) ? at : oldest;
  }, null);
  const soonestDue = dueLabel(actions[0]?.due_kind === "REVISION" || actions[0]?.due_kind === "VIDEO" ? actions[0]?.due_at : null);

  const [filter, setFilter] = useState<PostFilter>("all");
  // "Needs your action" narrows the Needs you list to what is overdue or to film; the list opens to all of it on request.
  const [needsOnly, setNeedsOnly] = useState(false);
  const needs = needsOnly ? actions : nextSteps;
  const openPost = (s: SubmissionSummary) => navigate(scriptNeedsChanges(s) ? `/submissions/${s.id}/script` : `/submissions/new?id=${s.id}`);
  const sent = useMemo(
    () =>
      mine
        .filter((s) => (s.status !== "DRAFT" && s.submitted_at) || scriptSent(s))
        // A script with a reviewer counts as in review; an approved script isn't an approved post.
        .filter((s) => filter === "all" || s.status === filter || (filter === "IN_REVIEW" && s.script_status === "IN_REVIEW" && scriptSent(s)))
        .sort((a, b) => sentAt(b).getTime() - sentAt(a).getTime()),
    [mine, filter]
  );

  // What reviewers did on their posts; their own actions (sending for review) aren't news to them.
  const activity = (summary.data?.activity ?? []).filter((a) => a.actor_id !== user?.id).slice(0, ACTIVITY_LIMIT);

  const loading = submissions.isLoading;
  const waiting = nextSteps.length;
  const headline = loading ? "" : waiting === 0 ? "Nothing is waiting on you right now." : `You have ${waiting} thing${waiting === 1 ? "" : "s"} waiting on you.`;
  // The most urgent one, as a shortcut to it.
  const soonestText = !soonestDue ? null : soonestDue.text.startsWith("Overdue") ? "One is overdue." : `One is ${soonestDue.text.replace(/^Due/, "due")}.`;

  return (
    <div data-canvas="contrast" className="mx-auto w-full max-w-[1400px] space-y-6 pb-8 animate-in fade-in duration-300 min-[112.5rem]:max-w-[2200px]">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {greeting(now)}
            {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {headline}
            {!loading && soonestText && actions[0] && (
              <button type="button" onClick={() => openPost(actions[0])} className="ml-1 font-medium text-blue-700 hover:underline dark:text-blue-300">
                {soonestText} Open it
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-lg px-4 font-semibold text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100"
            onClick={() => setBulkDialogOpen(true)}
          >
            <FileStack className="w-4 h-4 text-blue-600" /> Upload scripts
          </Button>
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

      <CreatorStats
        loading={loading}
        actions={actions}
        changes={changes}
        soonestDue={soonestDue}
        inReview={inReview}
        oldestInReview={oldestInReview}
        summary={summary.data}
        scheduled={scheduled}
        filter={filter}
        needsOnly={needsOnly}
        onNeeds={() => setNeedsOnly((on) => !on)}
        onFilter={setFilter}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] min-[112.5rem]:grid-cols-[minmax(0,1fr)_480px]">
        {/* Left: what needs them, and what they've sent */}
        <div className="flex min-w-0 flex-col gap-6">
          <div id="creator-needs" className="scroll-mt-4">
          <Section
            title="Needs you"
            count={loading || !needs.length ? undefined : needs.length}
            subtitle={needsOnly ? "Only changes to make and videos to film" : "Most urgent first"}
            action={
              <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {needsOnly && (
                  <button type="button" onClick={() => setNeedsOnly(false)} className="hover:underline">
                    Show everything
                  </button>
                )}
                <Link to="/submissions" className="hover:underline">
                  View all
                </Link>
              </div>
            }
          >
            {loading ? (
              <Loading />
            ) : needs.length === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">Nothing waiting on you</p>
                <p className="text-xs text-muted-foreground">No changes requested and no drafts. Create a post when you're ready.</p>
              </div>
            ) : (
              <div className="border-t border-border/60 pt-3">
                <ReviewSlideshow
                  key={String(needsOnly)}
                  label="Needs you"
                  slides={needs.map((s) => ({
                    key: s.id,
                    node: (
                      <NextStepCard
                        s={s}
                        onOpen={() => openPost(s)}
                        onOpenStep={(step) => navigate(stepPath(s.id, step as (typeof POST_STEPS)[number]["key"]))}
                      />
                    ),
                  }))}
                />
              </div>
            )}
          </Section>
          </div>

          <div id="creator-recent" className="scroll-mt-4">
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
        </div>

        {/* Right: the day's schedule, and what reviewers did */}
        <div className="flex min-w-0 flex-col gap-6">
          <DayAgenda posts={mine} loading={loading} />

          <Section title="Activity" subtitle="What reviewers did on your posts">
            <ActivityList items={activity} loading={summary.isLoading} empty="No reviewer activity on your posts yet." />
          </Section>
        </div>
      </div>

      <BulkScriptDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} />
    </div>
  );
}
