import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, differenceInCalendarDays, format, formatDistanceToNow, isPast, isSameMonth, isToday, isTomorrow, startOfMonth } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FilePen,
  FileText,
  History,
  Info,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  ScanEye,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import MultiSelectFilter from "@/components/ui/MultiSelectFilter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { CoverThumb } from "@/components/submissions/PostPreview";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import ReviewCommentsPanel from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import ComplianceView from "@/components/submissions/ComplianceView";
import DeleteDraftDialog from "@/components/submissions/DeleteDraftDialog";
import {
  ANALYSING_REFETCH_MS,
  authedFileUrl,
  dueInfo,
  isAnalysing,
  refetchWhileAnalysing,
  audienceCodes,
  brandCodes,
  audienceNames,
} from "@/components/submissions/submissionUi";
import { QUICK_CREATE, Score, issuesText, scriptNeedsChanges, scriptPillOf } from "@/components/dashboard/dashboardParts";
import { isSentimentRunning, useSentiment } from "@/hooks/useSentiment";
import { useAuth } from "@/lib/AuthContext";
import { useSubmitForReview } from "@/hooks/useSubmitForReview";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { submissionService } from "@/services/submissionService";
import type { Submission, SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// Stages, filters and sorting
// ---------------------------------------------------------------------------

/** The status as the team thinks of it: approved content with a future publish date is "Scheduled". */
type Stage = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "REJECTED";

function stageOf(s: { status: string; publish_at?: string | null }): Stage {
  if (s.status === "APPROVED" && s.publish_at && !isPast(new Date(s.publish_at))) return "SCHEDULED";
  return s.status as Stage;
}

/**
 * The tab a post is counted under. A script that has been sent isn't a draft: with a reviewer (or being sent) or
 * approved it's with "In review", and sent back it's under "Changes requested". Only a script not yet sent, or one
 * that failed to send, stays a draft.
 */
function tabOf(s: { status: string; publish_at?: string | null; script_status?: string | null; script_send_status?: string | null }): Stage {
  const stage = stageOf(s);
  if (stage !== "DRAFT") return stage;
  if (s.script_send_status === "PROCESSING" || s.script_status === "IN_REVIEW" || s.script_status === "APPROVED") return "IN_REVIEW";
  if (s.script_status === "EDITS_PROPOSED" || s.script_status === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
  return stage;
}

const STAGES: Record<Stage, { label: string; pill: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  IN_REVIEW: { label: "In review", pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes requested", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  REJECTED: { label: "Rejected", pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

// The stage pills along the top, each a filter.
const STAGE_FILTERS: { value: "" | Stage; label: string }[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "APPROVED", label: "Approved" },
  { value: "SCHEDULED", label: "Scheduled" },
];

type SortBy = "priority" | "updated" | "publish" | "score";
const SORT_LABELS: Record<SortBy, string> = {
  priority: "Needs action first",
  updated: "Newest first",
  publish: "Publish date",
  score: "Lowest check score",
};
const SUBMITTABLE = new Set(["DRAFT", "CHANGES_REQUESTED"]);
const FINISHED = new Set(["APPROVED", "REJECTED"]);

const PREFS_KEY = "contentPortal.prefs";
type Prefs = { sort: SortBy; scope: "mine" | "all" };
const DEFAULT_PREFS: Prefs = { sort: "priority", scope: "mine" };

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return { ...DEFAULT_PREFS, ...saved, sort: saved.sort in SORT_LABELS ? saved.sort : DEFAULT_PREFS.sort };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // preferences just won't persist
  }
}

const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

function sortItems(items: SubmissionSummary[], sort: SortBy) {
  if (sort === "priority") return items; // the API already returns needs-action-first order
  const time = (v?: string | null) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);
  const copy = [...items];
  if (sort === "publish") copy.sort((a, b) => time(a.publish_at) - time(b.publish_at));
  if (sort === "updated") copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (sort === "score") copy.sort((a, b) => (a.latest_score ?? 101) - (b.latest_score ?? 101));
  return copy;
}

/** Every account it posts through; older data may only have the single primary one. */
const accountsOf = (s: SubmissionSummary | Submission) => (s.accounts?.length ? s.accounts : s.account ? [s.account] : []);

const isVideo = (s: SubmissionSummary) => Boolean(s.cover?.kind === "MAIN" && s.cover.mime_type.startsWith("video/"));
const submitLabel = (s: { status: string }) => (s.status === "CHANGES_REQUESTED" ? "Resubmit" : "Send for review");

/** Side-by-side list and detail from this width; below it the detail opens as a sheet. */
const WIDE_QUERY = "(min-width: 1280px)";

function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
}

/** Names for brand and audience codes, from the same options New Submission uses. */
interface Labels {
  brand: (code?: string | null) => string | null;
  brands: (codes: string[]) => string | null;
  audience: (codes: string[]) => string | null;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function StagePill({ stage, small = false, script }: { stage: Stage; small?: boolean; script?: string | null }) {
  const st = scriptPillOf({ status: stage, script_status: script }) ?? STAGES[stage] ?? { label: stage, pill: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap ${small ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} ${st.pill}`}>
      {st.label}
    </span>
  );
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  VIDEO: "Video",
  SOCIAL_POST: "Post",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
  BLOG: "Article",
};

/** Deadline text, coloured by who it's waiting on: blue for a reviewer, amber for the creator, red once overdue. */
function DueLine({ dueAt, kind, className = "" }: { dueAt?: string | null; kind?: SubmissionSummary["due_kind"]; className?: string }) {
  const due = dueInfo(dueAt, kind);
  if (!due) return null;
  const tone = due.overdue ? "text-red-600 dark:text-red-400" : kind === "REVISION" || kind === "VIDEO" ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300";
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone} ${className}`} title={`Due ${due.exact}`}>
      <Clock className="w-3.5 h-3.5" /> {due.text}
    </span>
  );
}

/** When it goes out (or was last touched), with "past due" when a planned time passed without approval. */
function whenText(s: SubmissionSummary) {
  if (s.publish_at) {
    const date = new Date(s.publish_at);
    const pastDue = !FINISHED.has(s.status) && isPast(date);
    return { text: `${format(date, "MMM d, yyyy, h:mm a")}${pastDue ? " · Past due" : ""}`, pastDue };
  }
  return { text: format(new Date(s.updated_at), "MMM d, yyyy, h:mm a"), pastDue: false };
}

// ---------------------------------------------------------------------------
// Submission card (left column)
// ---------------------------------------------------------------------------

function SubmissionCard({
  s,
  selected,
  labels,
  showCreator,
  onSelect,
}: {
  s: SubmissionSummary;
  selected: boolean;
  labels: Labels;
  showCreator: boolean;
  onSelect: (s: SubmissionSummary) => void;
}) {
  const stage = stageOf(s);
  const when = whenText(s);
  const brand = labels.brands(brandCodes(s));
  const audience = labels.audience(audienceCodes(s));
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(s);
        }
      }}
      className={`group rounded-xl border bg-card p-3.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected
          ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30 dark:border-blue-500/70 dark:bg-blue-500/10"
          : "border-border/70 hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <StagePill stage={stage} small script={s.script_status} />
        {selected ? (
          <span className="text-[10px] font-semibold tracking-wider text-blue-700 dark:text-blue-300">SELECTED</span>
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>

      <div className="mt-3 flex gap-3">
        <div className="w-16 shrink-0">
          <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
            <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} script={s.script_excerpt} showPlay={false} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{CONTENT_TYPE_LABELS[s.content_type] ?? s.content_type}</p>
        </div>
        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{s.title}</p>
          {s.platforms.length > 0 && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300">
              <PlatformIcon platform={s.platforms[0] as SocialPlatform} className="w-3.5 h-3.5" />
              {platformName(s.platforms[0])}
              {s.platforms.length > 1 && ` +${s.platforms.length - 1}`}
            </p>
          )}
          {brand && <p className="mt-0.5 truncate">{brand}</p>}
          {audience && <p className="truncate">{audience}</p>}
        </div>
      </div>

      <div className="mt-3 space-y-0.5 text-[11px]">
        <DueLine dueAt={s.due_at} kind={s.due_kind} />
        <p className={when.pastDue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}>{when.text}</p>
        {showCreator && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <UserIcon className="w-3 h-3" /> By {s.created_by_name || "unknown"}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">{s.caption_text?.trim() || "No caption yet."}</span>
        <span className="inline-flex shrink-0 items-center gap-1" title="Review comments">
          <MessageSquare className="w-3.5 h-3.5" /> {s.comment_count ?? 0}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery card (creators): picture first, then the few facts they scan for
// ---------------------------------------------------------------------------

/** "Today", "Tomorrow", a weekday within the week ahead, otherwise the date. */
function friendlyDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, "h:mm a")}`;
  const days = differenceInCalendarDays(d, new Date());
  if (days > 1 && days < 7) return format(d, "EEEE, h:mm a");
  return format(d, "MMM d, yyyy");
}

/** One line saying where the post stands, coloured by whose turn it is: amber/red when the creator has to act,
 * grey when it's waiting on someone else. */
function statusLine(s: SubmissionSummary): { text: string; tone: string } {
  const muted = "text-muted-foreground";
  const stage = stageOf(s);
  const due = s.due_at ? new Date(s.due_at) : null;
  // A sent script is read and scored in the background: say so, or say why it couldn't be sent.
  if (s.script_send_status === "PROCESSING") return { text: "Processing script · calculating compliance score", tone: "font-medium text-blue-700 dark:text-blue-300" };
  if (s.script_send_status === "FAILED") return { text: s.script_send_error ?? "The script couldn't be sent", tone: "font-semibold text-red-600 dark:text-red-400" };
  // Video drafts in the script stage: where the script is comes first.
  if (stage === "DRAFT" && s.script_status && s.script_status !== "DRAFT") {
    const amber = "font-semibold text-amber-700 dark:text-amber-400";
    if (s.script_status === "IN_REVIEW") return { text: "Script with a reviewer", tone: muted };
    if (s.script_status === "EDITS_PROPOSED") return { text: "Reviewer edited your script · review the changes", tone: amber };
    if (s.script_status === "CHANGES_REQUESTED") return { text: "Script needs changes", tone: amber };
    if (s.script_status === "APPROVED") {
      const videoDue = s.due_kind === "VIDEO" && s.due_at ? new Date(s.due_at) : null;
      if (videoDue && isPast(videoDue)) return { text: `Script approved · video overdue by ${formatDistanceToNow(videoDue)}`, tone: "font-semibold text-red-600 dark:text-red-400" };
      if (videoDue) return { text: `Script approved · video due ${format(videoDue, "EEE, MMM d")}`, tone: "font-medium text-emerald-700 dark:text-emerald-400" };
      return { text: "Script approved · add the video", tone: "font-medium text-emerald-700 dark:text-emerald-400" };
    }
  }
  if (stage === "DRAFT") return { text: `Draft · edited ${format(new Date(s.updated_at), "MMM d")}`, tone: muted };
  if (stage === "CHANGES_REQUESTED") {
    if (!due) return { text: "A reviewer asked for changes", tone: "font-medium text-amber-700 dark:text-amber-400" };
    return isPast(due)
      ? { text: `Changes overdue by ${formatDistanceToNow(due)}`, tone: "font-semibold text-red-600 dark:text-red-400" }
      : { text: `Changes due ${format(due, "EEE, MMM d · h:mm a")}`, tone: "font-semibold text-amber-700 dark:text-amber-400" };
  }
  if (stage === "IN_REVIEW") {
    if (due && isPast(due)) return { text: `Waiting on reviewer · ${formatDistanceToNow(due)} past due`, tone: muted };
    if (due) return { text: `Waiting on reviewer · due ${format(due, "EEE, MMM d")}`, tone: muted };
    return { text: `Waiting on reviewer · sent ${format(new Date(s.submitted_at ?? s.updated_at), "MMM d")}`, tone: muted };
  }
  if (stage === "SCHEDULED") return { text: `Approved · goes out ${friendlyDate(s.publish_at!)}`, tone: muted };
  if (stage === "APPROVED")
    return { text: s.publish_at ? `Approved · publish date ${format(new Date(s.publish_at), "MMM d")}` : "Approved", tone: muted };
  return { text: STAGES[stage]?.label ?? s.status, tone: muted };
}

function GalleryCard({
  s,
  onSelect,
  onContinue,
  onDelete,
}: {
  s: SubmissionSummary;
  onSelect: (s: SubmissionSummary) => void;
  onContinue: (s: SubmissionSummary) => void;
  onDelete: (s: SubmissionSummary) => void;
}) {
  const stage = stageOf(s);
  const line = statusLine(s);
  const account = accountsOf(s)[0];
  const where = [
    s.platforms.length ? `${platformName(s.platforms[0])}${s.platforms.length > 1 ? ` +${s.platforms.length - 1}` : ""}` : null,
    account?.handle ? `@${account.handle.replace(/^@/, "")}` : account?.account_name,
  ]
    .filter(Boolean)
    .join(" · ");
  const fix = stage === "CHANGES_REQUESTED";
  // "to fix" only where the creator can act on it (a draft, or changes requested); otherwise just "found".
  const issueWords = issuesText(s.issue_count);
  const issues =
    s.analysis_pending || s.script_send_status === "PROCESSING" || s.latest_score == null
      ? null
      : !issueWords
      ? "No issues"
      : fix || stage === "DRAFT"
      ? issueWords
      : issueWords.replace("to fix", "found");
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onSelect(s)}
        className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} script={s.script_excerpt} showPlay={false} />
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
            {CONTENT_TYPE_LABELS[s.content_type] ?? s.content_type}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 pt-3.5">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{s.title}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              {s.platforms[0] && <PlatformIcon platform={s.platforms[0] as SocialPlatform} className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{where || "No account set"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StagePill stage={stage} small script={s.script_status} />
            <Score score={s.latest_score} pending={s.analysis_pending} progress={s.analysis_progress} unavailable={s.ai_unavailable} calculating={s.script_send_status === "PROCESSING"} />
            {issues && <span className="text-xs text-muted-foreground">{issues}</span>}
          </div>
          <p className={`text-sm ${line.tone}`}>{line.text}</p>
        </div>
      </button>
      {scriptNeedsChanges(s) ? (
        <div className="px-4 pb-4">
          <Button asChild className="h-9 w-full rounded-lg bg-blue-700 font-medium text-white hover:bg-blue-800">
            <Link to={`/submissions/${s.id}/script`}>Review changes</Link>
          </Button>
        </div>
      ) : stage === "DRAFT" && s.script_status === "IN_REVIEW" ? (
        // Already sent: nothing left to do on the draft, so it's just there to look at.
        <div className="px-4 pb-4">
          <Button asChild variant="outline" className="h-9 w-full rounded-lg font-medium">
            <Link to={`/submissions/${s.id}/script`}>View script</Link>
          </Button>
        </div>
      ) : (
        (fix || stage === "DRAFT") && (
          <div className="px-4 pb-4">
            <Button
              variant={fix ? "default" : "outline"}
              className={`h-9 w-full rounded-lg font-medium ${fix ? "bg-blue-700 text-white hover:bg-blue-800" : ""}`}
              onClick={() => onContinue(s)}
            >
              {fix ? "Fix issues" : s.script_status === "APPROVED" ? "Upload video" : "Continue draft"}
            </Button>
          </div>
        )
      )}
      {/* A draft that hasn't gone to a reviewer can be thrown away, of any type. */}
      {s.can_delete && (
        <div className="px-4 pb-3.5 -mt-1">
          <button
            type="button"
            onClick={() => onDelete(s)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete draft
          </button>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Detail panel: media, tabs and the actions for whoever is looking
// ---------------------------------------------------------------------------

function HistoryView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["submission-history", id],
    queryFn: () => submissionService.history(id),
    staleTime: 0,
  });
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history...
      </p>
    );
  }
  const events = data?.events ?? [];
  if (!events.length) return <p className="text-xs text-muted-foreground">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((e) => (
        <li key={e.id} className="text-xs">
          <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-blue-500" />
          <p className="font-medium text-foreground">{e.message}</p>
          <p className="text-muted-foreground">
            {e.actor_name ? `${e.actor_name} · ` : ""}
            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** One of the two analysis cards: what it checks, its result so far, and a way to open or run it. */
function CheckCard({
  icon: Icon,
  title,
  status,
  statusTone = "text-muted-foreground",
  description,
  action,
  onAction,
  busy = false,
}: {
  icon: typeof ShieldCheck;
  title: string;
  status: string;
  statusTone?: string;
  description: string;
  action?: string | null;
  onAction?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-blue-700 dark:text-blue-300" /> {title}
        </p>
        <span className={`text-[11px] font-semibold ${statusTone}`}>{status}</span>
      </div>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Supports human review</span>
        {action && (
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline disabled:opacity-60 dark:text-blue-300"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />} {action} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  summary,
  labels,
  userId,
  userName,
  canComment,
  onSubmit,
  onDelete,
}: {
  summary: SubmissionSummary;
  labels: Labels;
  userId?: string;
  userName?: string;
  /** Reviewers can comment on anyone's content; creators on their own. */
  canComment: boolean;
  onSubmit: (s: SubmissionSummary) => void;
  onDelete: (s: SubmissionSummary) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setActiveVideoId } = useVideoUploadQueue();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);
  const [openCheck, setOpenCheck] = useState<"compliance" | "sentiment" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { creatorView } = useAuth();
  const { data: sub, isLoading } = useQuery({
    queryKey: ["submission", summary.id],
    queryFn: () => submissionService.get(summary.id),
    staleTime: 0,
    // Check back quickly while the post is still being read, so the score shows up soon after it's ready.
    refetchInterval: (q) => (isAnalysing(q.state.data?.latest_check) ? ANALYSING_REFETCH_MS : false),
  });
  const { analysis } = useSentiment(summary.id);
  const runCheck = useMutation({
    mutationFn: () => submissionService.runCheck(summary.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["submission", summary.id], updated);
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setOpenCheck("compliance");
    },
    onError: (err) => toast.error(`Couldn't run the check: ${(err as Error).message}`),
  });

  const mine = summary.created_by === userId;
  const stage = stageOf(sub ?? summary);
  const media =
    sub?.files.find((f) => f.kind === "MAIN" && /^(video|image)\//.test(f.mime_type)) ??
    sub?.files.find((f) => f.mime_type.startsWith("image/")) ??
    null;
  const mediaIsVideo = Boolean(media?.mime_type.startsWith("video/"));
  const seek = mediaIsVideo
    ? (sec: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = sec;
        void v.play().catch(() => undefined);
      }
    : undefined;
  const openInScreener = () => {
    setActiveVideoId(`sub-${summary.id}`);
    navigate("/compliance/scanner");
  };
  const showScreener = isVideo(summary) && summary.status !== "DRAFT";
  const check = sub?.latest_check;
  const canRunCheck = Boolean(sub?.can_edit);
  const sentimentDone = analysis?.status === "COMPLETED";
  const sentimentRunning = isSentimentRunning(analysis);
  const facts: [string, React.ReactNode][] = [
    ["Brands", labels.brands(brandCodes(summary))],
    [
      "Platforms",
      summary.platforms.length ? `${platformName(summary.platforms[0])}${summary.platforms.length > 1 ? ` +${summary.platforms.length - 1}` : ""}` : null,
    ],
    ["Audiences", labels.audience(audienceCodes(summary))],
    ["Submitted", summary.submitted_at ? format(new Date(summary.submitted_at), "MMM d, yyyy, h:mm a") : "Not yet"],
  ];

  // What the person looking at it can do, and how the footer describes it.
  let footerTitle = STAGES[stage]?.label ?? "Status";
  let footerNote = "";
  let actions: React.ReactNode = null;
  if (sub?.can_review && !creatorView) {
    footerTitle = "Human approval";
    footerNote = "Your decision is recorded in the audit trail.";
    actions = (
      <ReviewDecisionPanel
        layout="inline"
        target={{
          id: sub.id,
          reference_code: sub.reference_code,
          title: sub.title,
          status: sub.status,
          current_version: sub.current_version,
          platforms: sub.platforms,
          publish_at: sub.publish_at,
          due_at: sub.due_at,
          due_kind: sub.due_kind,
          ai_unavailable: sub.latest_check?.ai_unavailable,
          analysis_pending: isAnalysing(sub.latest_check),
          can_review: sub.can_review,
          can_approve: sub.can_approve,
          approver_names: sub.approver_names,
          open_critical_flags: sub.open_critical_flags,
          approval_score: sub.approval_score,
          min_approval_score: sub.min_approval_score,
          score: isAnalysing(sub.latest_check) || sub.latest_check?.ai_unavailable ? null : sub.latest_check?.score ?? null,
          manual_rules: sub.latest_check?.manual_review_rules,
        }}
      />
    );
  } else if (summary.status === "DRAFT" && (summary.script_status === "IN_REVIEW" || scriptNeedsChanges(summary)) && mine) {
    // The script is with a reviewer, or back from one: the draft itself has nothing to edit or send, the script page does.
    const back = scriptNeedsChanges(summary);
    footerTitle = back ? "Your next step" : "Script in review";
    footerNote = back
      ? summary.script_status === "EDITS_PROPOSED"
        ? "Your reviewer edited the script. Accept the changes or edit it and send it again."
        : "Your reviewer asked for changes to the script. Make them and send it again."
      : "Your script is with a reviewer. You'll be notified when it's decided.";
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white" onClick={() => navigate(`/submissions/${summary.id}/script`)}>
          <FileText className="w-3.5 h-3.5" /> {back ? "Review changes" : "Review script"}
        </Button>
      </div>
    );
  } else if (summary.status === "DRAFT" && summary.script_status === "APPROVED" && mine && !sub?.files?.some((f) => f.kind === "MAIN")) {
    // The script is approved and there's no video yet: the video is what's left to add, so it comes before sending.
    footerTitle = "Script approved";
    footerNote = "Film from the approved script, then upload the video.";
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white" onClick={() => navigate(`/submissions/new?id=${summary.id}`)}>
          <Upload className="w-3.5 h-3.5" /> Upload the video
        </Button>
      </div>
    );
  } else if (SUBMITTABLE.has(summary.status) && mine) {
    footerTitle = "Your next step";
    footerNote = summary.status === "CHANGES_REQUESTED" ? "Make the requested changes, then resubmit it." : "Send it for review when it's ready.";
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold" onClick={() => navigate(`/submissions/new?id=${summary.id}`)}>
          <FilePen className="w-3.5 h-3.5" /> {summary.status === "CHANGES_REQUESTED" ? "Make changes" : "Edit draft"}
        </Button>
        <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white" onClick={() => onSubmit(summary)}>
          <Send className="w-3.5 h-3.5" /> {submitLabel(summary)}
        </Button>
      </div>
    );
  } else if (summary.status === "APPROVED" && (mine || summary.can_manage_approval)) {
    footerTitle = "Approved";
    footerNote = "It's on the content calendar. Reschedule it or reopen it if something changes.";
    actions = (
      <div className="flex flex-wrap justify-end gap-2">
        <ApprovalActions target={sub ?? summary} isCreator={mine} buttonClassName="h-9 text-xs font-semibold gap-1.5" />
      </div>
    );
  } else if (summary.status === "IN_REVIEW") {
    footerTitle = "In review";
    footerNote = sub?.approver_names?.length
      ? `Waiting for a reviewer. Final approval: ${sub.approver_names.join(", ")}.`
      : mine
      ? "Waiting for a reviewer. You'll be notified when it's decided."
      : "Waiting for a reviewer.";
  } else if (summary.status === "CHANGES_REQUESTED") {
    footerNote = "Waiting for the creator to make changes and resubmit.";
  }

  return (
    <div className="@container rounded-xl border border-border/70 bg-card shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            <ClipboardCheck className="w-3.5 h-3.5" /> Content review
          </p>
          <h2 className="mt-1.5 text-xl font-semibold leading-snug text-foreground">{summary.title}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {showScreener && (
                  <DropdownMenuItem className="text-xs gap-2" onClick={openInScreener}>
                    <ScanEye className="w-3.5 h-3.5" /> Open in Content Screener
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowHistory(true)}>
                  <History className="w-3.5 h-3.5" /> View audit trail
                </DropdownMenuItem>
                {summary.can_delete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" className="text-xs gap-2" onClick={() => onDelete(summary)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete draft
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <StagePill stage={stage} small script={summary.script_status} />
        </div>
      </div>

      {/* The next step and its buttons, up top so it's the first thing to act on */}
      <section className="border-y border-border/70 bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{footerTitle}</p>
            {footerNote && <p className="text-[11px] text-muted-foreground">{footerNote}</p>}
          </div>
          {actions && <div className="min-w-0">{actions}</div>}
        </div>
      </section>

      {/* Media and the facts that matter for the review */}
      <div className="grid gap-5 px-5 pt-4 pb-5 @xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900">
            {media && mediaIsVideo ? (
              <video
                key={media.id}
                ref={videoRef}
                src={authedFileUrl(media.url)}
                controls
                preload="metadata"
                className="h-full w-full object-contain"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />
            ) : media ? (
              <img src={authedFileUrl(media.url)} alt="" className="h-full w-full object-contain" />
            ) : (
              <CoverThumb cover={summary.cover} contentType={summary.content_type} caption={summary.caption_text} script={summary.script_excerpt} showPlay={false} />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{media ? (mediaIsVideo ? "Video" : "Image") : CONTENT_TYPE_LABELS[summary.content_type] ?? "Content"}</span>
            {summary.script_status && summary.script_status !== "DRAFT" && (
              <Link to={`/submissions/${summary.id}/script`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                <FileText className="w-3.5 h-3.5" /> View script
              </Link>
            )}
            {showScreener && (
              <button type="button" onClick={openInScreener} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                <ScanEye className="w-3.5 h-3.5" /> Open in Content Screener
              </button>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-4 text-xs">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium text-foreground break-words">{value || "—"}</dd>
            </div>
          ))}
          {summary.due_at && (
            <div className="col-span-2 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
              <DueLine dueAt={summary.due_at} kind={summary.due_kind} className="text-xs" />
            </div>
          )}
          <div className="col-span-2 min-w-0">
            <dt className="text-muted-foreground">Caption</dt>
            <dd className="mt-0.5 text-foreground whitespace-pre-wrap break-words line-clamp-5">{summary.caption_text?.trim() || "No caption yet."}</dd>
          </div>
        </dl>
      </div>

      {/* Review checks */}
      <section className="border-t border-border/70 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Review checks</h3>
          <p className="text-[11px] text-muted-foreground">Analysis does not approve or publish content.</p>
        </div>
        <div className="mt-3 grid gap-3 @xl:grid-cols-2">
          <CheckCard
            icon={ShieldCheck}
            title="Compliance Check"
            status={
              summary.script_send_status === "PROCESSING"
                ? "Calculating the compliance score…"
                : check && isAnalysing(check)
                ? "Under review: still reading the post"
                : check?.ai_unavailable
                ? "No score: the AI review couldn't run"
                : check
                ? `${check.score}/100 · ${check.blocked ? "Blocked" : check.is_compliant ? "No issues" : `${check.violations_count} issue${check.violations_count === 1 ? "" : "s"}`}`
                : summary.script_status
                ? "Runs automatically when the script is sent"
                : "No results yet"
            }
            statusTone={
              summary.script_send_status === "PROCESSING" || !check ? undefined : check.traffic_light === "RED" ? "text-red-600 dark:text-red-400" : check.traffic_light === "YELLOW" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
            }
            description="Check regulatory, legal and brand messaging rules, audience, region and product-development stage."
            action={
              summary.script_send_status === "PROCESSING"
                ? null
                : check
                ? openCheck === "compliance"
                  ? "Hide results"
                  : "View results"
                : canRunCheck && !summary.script_status
                ? "Run compliance check"
                : null
            }
            busy={runCheck.isPending}
            onAction={() => (check ? setOpenCheck((o) => (o === "compliance" ? null : "compliance")) : runCheck.mutate())}
          />
          <CheckCard
            icon={BarChart3}
            title="Sentiment Analysis"
            status={sentimentDone ? "Results ready" : sentimentRunning ? "Running..." : "No results yet"}
            statusTone={sentimentDone ? "text-emerald-700 dark:text-emerald-300" : undefined}
            description="Assess tone and messaging for the intended audience. Review the analysis before making a decision."
            action={openCheck === "sentiment" ? "Hide analysis" : sentimentDone ? "View analysis" : "Analyze sentiment"}
            onAction={() => setOpenCheck((o) => (o === "sentiment" ? null : "sentiment"))}
          />
        </div>
        {!check && !canRunCheck && (
          <p className="mt-2 text-[11px] text-muted-foreground">The compliance check runs when it's sent for review.</p>
        )}
        {openCheck === "compliance" && sub && (
          <div className="mt-3">
            <ComplianceView sub={sub} />
          </div>
        )}
        {openCheck === "sentiment" && (
          <div className="mt-3 rounded-xl border border-border/70 p-4">
            <SentimentPanel submissionId={summary.id} onSeek={seek} />
          </div>
        )}
      </section>

      {/* Feedback: nothing to show on a draft until it's been sent for review (kept if a withdrawn draft has comments) */}
      {(summary.status !== "DRAFT" || (summary.comment_count ?? 0) > 0) && (
        <section className="border-t border-border/70 px-5 py-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquare className="w-4 h-4" /> Review Feedback <span className="font-normal text-muted-foreground">({summary.comment_count ?? 0})</span>
            </h3>
            {(canComment || mine) && userName && <p className="text-[11px] text-muted-foreground">Commenting as {userName}</p>}
          </div>
          {isLoading || !sub ? (
            <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </p>
          ) : (
            <ReviewCommentsPanel
              submissionId={sub.id}
              showHeader={false}
              canComment={canComment || mine}
              currentTime={mediaIsVideo ? currentTime ?? 0 : undefined}
              onSeek={seek}
              emptyText={
                !canComment
                  ? "No feedback yet. The reviewer's comments show here; leave them a note below if there's anything they should know."
                  : "No feedback yet. Start the review with a comment, or pin feedback to a moment in the video."
              }
            />
          )}
        </section>
      )}

      {/* Approval note and audit trail */}
      <section className="rounded-b-xl border-t border-border/70 bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Approval is not publication. Calendar handoff does not publish content.
          </span>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            <History className="w-3.5 h-3.5" /> {showHistory ? "Hide audit trail" : "View audit trail"}
          </button>
        </div>
        {showHistory && (
          <div className="mt-3 rounded-lg border border-border/70 bg-card p-4">
            <HistoryView id={summary.id} />
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionsListPage() {
  const [stage, setStage] = useState<"" | Stage>("");
  const [search, setSearch] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SubmissionSummary | null>(null);
  const [deleting, setDeleting] = useState<SubmissionSummary | null>(null);
  const navigate = useNavigate();
  const isWide = useIsWide();
  const submit = useSubmitForReview();
  // Super admins, Content Managers and reviewers can switch to everyone's content.
  const { hasPermission, user, creatorView } = useAuth();
  // Admins keep "Everyone's" even when viewing the app as a creator (the server allows them every post).
  const canSeeAll = hasPermission("CONTENT_SUBMISSIONS_VIEW") || hasPermission("CONTENT_REVIEW_APPROVE") || creatorView;
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  // Creators browse a gallery and open details in a side sheet; reviewers keep the list beside the review panel.
  const gallery = !isReviewer;

  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  const scope = canSeeAll ? prefs.scope : "mine";
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    // Statuses change from other screens (autosave, submit); always show the latest.
    staleTime: 0,
    refetchInterval: refetchWhileAnalysing,
  });
  const { data: options } = useQuery({
    queryKey: ["submission-options"],
    queryFn: submissionService.getOptions,
    staleTime: 5 * 60_000,
  });
  const labels: Labels = useMemo(
    () => ({
      brand: (code) => (code ? options?.brands.find((b) => b.code === code)?.name ?? code : null),
      brands: (codes) => (codes.length ? codes.map((c) => options?.brands.find((b) => b.code === c)?.name ?? c).join(", ") : null),
      audience: (codes) => audienceNames(codes, options?.audiences),
    }),
    [options]
  );

  // Creators see one month at a time, by when each post was first created. Work waiting on them (drafts and
  // changes requested) is never hidden by the month: those two tabs count and show every month.
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const onCurrentMonth = isSameMonth(month, new Date());
  const monthless = stage === "DRAFT" || stage === "CHANGES_REQUESTED";
  const inMonth = useMemo(() => data.filter((s) => isSameMonth(new Date(s.created_at), month)), [data, month]);
  const inView = gallery && !monthless ? inMonth : data;

  const stageCounts = useMemo(() => {
    const source = gallery ? inMonth : data;
    const counts: Record<string, number> = { "": source.length };
    for (const s of source) {
      const st = tabOf(s);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    if (gallery) {
      counts.DRAFT = data.filter((s) => tabOf(s) === "DRAFT").length;
      counts.CHANGES_REQUESTED = data.filter((s) => tabOf(s) === "CHANGES_REQUESTED").length;
    }
    return counts;
  }, [data, inMonth, gallery]);

  // Platform options come from what's actually in the list.
  const platformsInList = useMemo(() => [...new Set(data.flatMap((s) => s.platforms))].sort(), [data]);
  // The same brands, in the same order, as the brand picker on New Submission; plus any retired brand still on
  // older content, so it can be found.
  const brandsInList = useMemo(() => {
    const managed = (options?.brands ?? []).map((b) => b.code);
    const older = [...new Set(data.flatMap((s) => brandCodes(s)).filter((c): c is string => Boolean(c) && !managed.includes(c!)))].sort();
    return [...managed, ...older];
  }, [options, data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = inView.filter(
      (s) =>
        (!stage || tabOf(s) === stage) &&
        (platforms.length === 0 || s.platforms.some((p) => platforms.includes(p))) &&
        (brands.length === 0 || brandCodes(s).some((c) => brands.includes(c))) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.reference_code.toLowerCase().includes(q) ||
          (s.caption_text ?? "").toLowerCase().includes(q) ||
          accountsOf(s).some((a) => a.account_name.toLowerCase().includes(q)) ||
          (s.created_by_name ?? "").toLowerCase().includes(q))
    );
    return sortItems(filtered, prefs.sort);
  }, [inView, stage, platforms, brands, search, prefs.sort]);

  // Wide screens always show something in the panel: the picked item, or the first one in the list.
  const picked = visible.find((s) => s.id === selectedId) ?? null;
  const selected = picked ?? (isWide && !gallery ? visible[0] ?? null : null);

  const filtersActive = Boolean(stage || search || platforms.length || brands.length);
  const clearFilters = () => {
    setStage("");
    setSearch("");
    setPlatforms([]);
    setBrands([]);
  };
  const waitingForMe = creatorView ? 0 : data.filter((s) => s.can_review).length;

  const panel = (s: SubmissionSummary) => (
    <ReviewCard
      key={s.id}
      summary={s}
      labels={labels}
      userId={user?.id}
      userName={user?.full_name}
      canComment={isReviewer}
      onSubmit={setConfirming}
      onDelete={setDeleting}
    />
  );
  const [showFilters, setShowFilters] = useState(true);

  return (
    <div data-canvas={gallery ? "contrast" : "plain"} className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300 min-[112.5rem]:max-w-[2200px]">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{scope === "all" ? "All posts" : "My posts"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isReviewer
              ? "Review submitted content, run compliance checks, and manage approvals."
              : scope === "all"
              ? "Everyone's posts on your brands, with what needs action first."
              : "Everything you've created, with what needs you first."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {waitingForMe > 0 && (
            <button
              type="button"
              onClick={() => setStage("IN_REVIEW")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              <Clock className="w-4 h-4" /> {waitingForMe} waiting for your review
            </button>
          )}
          <Button asChild className="h-10 rounded-lg px-4 gap-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white">
            <Link to="/submissions/new">
              <Plus className="w-4 h-4" /> New post
            </Link>
          </Button>
        </div>
      </header>

      {/* Status tabs: the one status filter */}
      <div className="flex max-w-full flex-wrap gap-1 self-start rounded-[10px] bg-muted p-1 w-fit" role="group" aria-label="Filter by status">
        {STAGE_FILTERS.map((f) => {
          const active = stage === f.value;
          const count = stageCounts[f.value] ?? 0;
          return (
            <button
              key={f.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setStage(active && f.value ? "" : f.value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-card text-foreground shadow-sm"
                  : count === 0
                  ? "text-muted-foreground/60 hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className={`text-xs tabular-nums ${active ? "text-muted-foreground" : count === 0 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                {isLoading ? "–" : count}
              </span>
            </button>
          );
        })}
      </div>

      {gallery ? (
        <>
          {/* Filters, top right under the pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1" role="group" aria-label="Month">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-card"
                  onClick={() => setMonth(addMonths(month, -1))}
                  disabled={monthless}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="min-w-[140px] text-center leading-tight" aria-live="polite">
                  <p className="text-sm font-semibold text-foreground">{monthless ? "All months" : format(month, "MMMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {isLoading
                      ? "Loading..."
                      : monthless
                      ? `${visible.length} ${visible.length === 1 ? "post" : "posts"} waiting on you`
                      : `${inMonth.length} ${inMonth.length === 1 ? "post" : "posts"} this month`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-card"
                  onClick={() => setMonth(addMonths(month, 1))}
                  disabled={onCurrentMonth || monthless}
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                {!onCurrentMonth && !monthless && (
                  <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    This month
                  </button>
                )}
              </div>
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" /> Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canSeeAll && (
                <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Whose content">
                  {(
                    [
                      ["mine", "My content"],
                      ["all", "Everyone's"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={scope === v}
                      onClick={() => setPrefs({ scope: v })}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        scope === v ? "bg-card text-blue-700 shadow-sm dark:text-blue-300" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or SUB number"
                  aria-label="Search posts"
                  className="h-9 rounded-lg bg-card pl-9 text-sm"
                />
              </div>
              <MultiSelectFilter
                options={platformsInList.map((p) => ({ value: p, label: platformName(p) }))}
                value={platforms}
                onChange={setPlatforms}
                allLabel="All Platforms"
                noun="platform"
                ariaLabel="Platform"
                className="w-[140px]"
              />
              <MultiSelectFilter
                options={brandsInList.map((b) => ({ value: b, label: labels.brand(b) ?? b }))}
                value={brands}
                onChange={setBrands}
                allLabel="All Brands"
                noun="brand"
                ariaLabel="Brand"
                className="w-[140px]"
              />
              <Select value={prefs.sort} onValueChange={(v) => setPrefs({ sort: v as SortBy })}>
                <SelectTrigger className="h-9 w-[160px] rounded-lg bg-card text-xs" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading content...
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">Couldn't load content: {(error as Error).message}</div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              {data.length === 0 ? (
                <>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    <Sparkles className="w-6 h-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {scope === "all" ? "No one has created any content yet" : "Your first post starts here"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Pick what you're making. We'll check it against the rulebook as you go.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {QUICK_CREATE.map(({ type, label, Icon }) => (
                      <Link
                        key={type}
                        to={`/submissions/new?type=${type}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : inView.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing was created in {format(month, "MMMM yyyy")}.</p>
              ) : (
                <>
                  <Search className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Nothing matches these filters.</p>
                  <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[112.5rem]:grid-cols-5">
                {visible.map((s) => (
                  <GalleryCard
                    key={s.id}
                    s={s}
                    onSelect={(item) => setSelectedId(item.id)}
                    onContinue={(item) => navigate(`/submissions/new?id=${item.id}`)}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex items-start gap-5">
          {/* Submissions */}
          <div className={`${isWide ? "w-[320px] 2xl:w-[340px] shrink-0" : "min-w-0 flex-1"} space-y-3`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Submissions <span className="font-normal text-muted-foreground">{visible.length}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
                aria-label={showFilters ? "Hide filters" : "Show filters"}
                title={showFilters ? "Hide filters" : "Show filters"}
                className={`rounded-md p-1.5 transition-colors ${showFilters ? "text-foreground" : "text-muted-foreground"} hover:bg-muted`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {canSeeAll && (
              <div className="grid grid-cols-2 rounded-lg bg-muted p-1" role="group" aria-label="Whose content">
                {(
                  [
                    ["mine", "My content"],
                    ["all", "Everyone's"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={scope === v}
                    onClick={() => setPrefs({ scope: v })}
                    className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      scope === v ? "bg-card text-blue-700 shadow-sm dark:text-blue-300" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {showFilters && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search content..."
                    aria-label="Search content"
                    className="h-9 rounded-lg pl-9 text-xs"
                  />
                </div>
                <div className={`grid gap-2 ${isWide ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                  <MultiSelectFilter
                    options={platformsInList.map((p) => ({ value: p, label: platformName(p) }))}
                    value={platforms}
                    onChange={setPlatforms}
                    allLabel="All Platforms"
                    noun="platform"
                    ariaLabel="Platform"
                    className="w-full"
                  />
                  <MultiSelectFilter
                    options={brandsInList.map((b) => ({ value: b, label: labels.brand(b) ?? b }))}
                    value={brands}
                    onChange={setBrands}
                    allLabel="All Brands"
                    noun="brand"
                    ariaLabel="Brand"
                    className="w-full"
                  />
                  <Select value={prefs.sort} onValueChange={(v) => setPrefs({ sort: v as SortBy })}>
                    <SelectTrigger className={`h-9 w-full rounded-lg text-xs ${isWide ? "col-span-2" : "col-span-2 sm:col-span-1"}`} aria-label="Sort by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {SORT_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading content...
              </div>
            ) : isError ? (
              <div className="py-16 text-center text-sm text-red-600">Couldn't load content: {(error as Error).message}</div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                {data.length === 0 ? (
                  <>
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <Sparkles className="w-6 h-6" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      {scope === "all" ? "No one has created any content yet" : "Your first post starts here"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Pick what you're making. We'll check it against the rulebook as you go.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {QUICK_CREATE.map(({ type, label, Icon }) => (
                        <Link
                          key={type}
                          to={`/submissions/new?type=${type}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                        >
                          <Icon className="w-3.5 h-3.5" /> {label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Search className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Nothing matches these filters.</p>
                    <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className={isWide ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
                  {visible.map((s) => (
                    <SubmissionCard
                      key={s.id}
                      s={s}
                      selected={selected?.id === s.id}
                      labels={labels}
                      showCreator={scope === "all"}
                      onSelect={(item) => setSelectedId(item.id)}
                    />
                  ))}
                </div>
                <p className="pt-1 text-center text-[11px] text-muted-foreground">
                  {visible.length === data.length ? `Showing all ${data.length} submissions` : `Showing ${visible.length} of ${data.length} submissions`}
                </p>
              </>
            )}
          </div>

          {/* Review card (wide screens) */}
          {isWide && selected && <div className="min-w-0 flex-1">{panel(selected)}</div>}
        </div>
      )}

      {/* Creators: the post opens as a pop-up in the middle of the screen */}
      <Dialog open={gallery && Boolean(picked)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent showCloseButton={false} className="max-h-[90vh] gap-0 overflow-visible bg-transparent p-0 ring-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">{picked?.title ?? "Content"}</DialogTitle>
          <DialogDescription className="sr-only">Details, review feedback and compliance check</DialogDescription>
          <DialogClose
            className="absolute -top-11 right-0 grid h-9 w-9 place-items-center rounded-full bg-card text-foreground shadow-md transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </DialogClose>
          <div className="max-h-[90vh] overflow-y-auto rounded-xl">{picked && panel(picked)}</div>
        </DialogContent>
      </Dialog>

      {/* Reviewers on narrower screens: the post opens as a side sheet */}
      <Sheet open={!gallery && !isWide && Boolean(picked)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4">
          <SheetHeader className="sr-only">
            <SheetTitle>{picked?.title ?? "Content"}</SheetTitle>
            <SheetDescription>Review feedback, compliance check and details</SheetDescription>
          </SheetHeader>
          {picked && panel(picked)}
        </SheetContent>
      </Sheet>

      <DeleteDraftDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={() => setSelectedId(null)} />

      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4" /> Send {confirming?.reference_code} for review?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">
                <strong>{confirming?.title}</strong> is submitted for compliance review as version {(confirming?.current_version ?? 0) + 1}. The
                rulebook check runs right away.
              </span>
              <span className="block">You can withdraw it later if you need to make changes.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs gap-1"
              onClick={() => {
                if (!confirming) return;
                const target = confirming;
                submit.mutate({
                  id: target.id,
                  referenceCode: target.reference_code,
                  isVideo: isVideo(target),
                });
                setConfirming(null);
              }}
            >
              <Send className="w-3.5 h-3.5" /> Send for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
