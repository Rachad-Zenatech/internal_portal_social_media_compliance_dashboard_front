import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, differenceInCalendarDays, format, formatDistanceToNow, isPast, isSameMonth, isToday, isTomorrow, startOfMonth } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FilePen,
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
  User as UserIcon,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import ScoreBreakdown from "@/components/submissions/ScoreBreakdown";
import CheckCoverage from "@/components/submissions/CheckCoverage";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import ReviewCommentsPanel from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import DeleteDraftDialog from "@/components/submissions/DeleteDraftDialog";
import { UnderReviewBadge, authedFileUrl, dueInfo, isAnalysing } from "@/components/submissions/submissionUi";
import { QUICK_CREATE } from "@/components/dashboard/dashboardParts";
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

const STAGES: Record<Stage, { label: string; pill: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  IN_REVIEW: { label: "In Review", pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes Requested", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  REJECTED: { label: "Rejected", pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

// The stage pills along the top, each a filter.
const STAGE_FILTERS: { value: "" | Stage; label: string }[] = [
  { value: "", label: "All Content" },
  { value: "DRAFT", label: "Drafts" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "CHANGES_REQUESTED", label: "Changes Requested" },
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
  audience: (code?: string | null) => string | null;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function StagePill({ stage, small = false }: { stage: Stage; small?: boolean }) {
  const st = STAGES[stage] ?? { label: stage, pill: "bg-muted text-muted-foreground" };
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
  const tone = due.overdue ? "text-red-600 dark:text-red-400" : kind === "REVISION" ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300";
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
  const brand = labels.brand(s.brand_code);
  const audience = labels.audience(s.audience);
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
        <StagePill stage={stage} small />
        {selected ? (
          <span className="text-[10px] font-semibold tracking-wider text-blue-700 dark:text-blue-300">SELECTED</span>
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>

      <div className="mt-3 flex gap-3">
        <div className="w-16 shrink-0">
          <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
            <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
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

function GalleryCard({ s, onSelect }: { s: SubmissionSummary; onSelect: (s: SubmissionSummary) => void }) {
  const stage = stageOf(s);
  const when = s.publish_at
    ? { text: friendlyDate(s.publish_at), pastDue: !FINISHED.has(s.status) && isPast(new Date(s.publish_at)) }
    : { text: `Edited ${formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}`, pastDue: false };
  return (
    <button
      type="button"
      onClick={() => onSelect(s)}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card text-left shadow-[0_1px_2px_oklch(0_0_0/0.05)] transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
        {s.platforms.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-foreground/80">
            {s.platforms.slice(0, 3).map((pl) => (
              <span key={pl} className="inline-flex items-center gap-1">
                <PlatformIcon platform={pl as SocialPlatform} className="w-3.5 h-3.5" /> {platformName(pl)}
              </span>
            ))}
            {s.platforms.length > 3 && <span className="text-muted-foreground">+{s.platforms.length - 3}</span>}
          </p>
        )}
        <div>
          <StagePill stage={stage} small />
        </div>
        <p className={`text-xs ${when.pastDue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
          {when.text}
          {when.pastDue && " · Past due"}
        </p>
        <DueLine dueAt={s.due_at} kind={s.due_kind} className="text-xs" />
        <span className="mt-auto w-fit rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {CONTENT_TYPE_LABELS[s.content_type] ?? s.content_type}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail panel: media, tabs and the actions for whoever is looking
// ---------------------------------------------------------------------------

function ComplianceView({ sub }: { sub: Submission }) {
  const { creatorView } = useAuth();
  const canReview = Boolean(sub.can_review) && !creatorView;
  const check = sub.latest_check;
  if (!check) {
    return <p className="text-xs text-muted-foreground">Not checked yet. The rulebook check runs when it's sent for review.</p>;
  }
  return (
    <div className="rounded-xl border border-border/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          {check.traffic_light === "RED" ? (
            <XCircle className="w-4 h-4 text-red-600" />
          ) : check.traffic_light === "YELLOW" ? (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
          {check.is_compliant ? "No issues found in the text" : `${check.violations_count} potential issue${check.violations_count === 1 ? "" : "s"}`}
        </span>
        {isAnalysing(check) ? <UnderReviewBadge /> : <span className="tabular-nums">{check.score}/100</span>}
      </div>
      <CheckCoverage check={check} />
      {sub.check_outdated && (
        <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {sub.status === "APPROVED" || sub.status === "REJECTED"
            ? "Decided under an earlier version of the rulebook; rules have changed since."
            : "The rulebook has changed since this check. It's checked again when it's next sent for review."}
        </p>
      )}
      <ScoreBreakdown check={check} />
      {/* Reviewers make their call on each flag: a false alarm is dismissed with a reason (the score stays). */}
      {canReview && check.violations.some((v) => v.rule_id) && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          {check.violations.map((v) => (
            <div key={v.rule_id} className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">
                {v.rule_number} · {v.flagged_terms.map((t) => `"${t}"`).join(", ") || "missing disclaimer"}
              </p>
              <FlagReviewControl
                submissionId={sub.id}
                ruleId={v.rule_id}
                ruleNumber={v.rule_number}
                currentVersion={sub.current_version}
                canDismiss
              />
            </div>
          ))}
        </div>
      )}
      {/* Checks saved before penalties were recorded have no breakdown; list what they flagged. */}
      {!check.violations.some((v) => v.penalty != null) &&
        check.violations.map((v) => (
          <div key={v.rule_id} className="text-xs border-t border-border/60 pt-2.5">
            <p className="font-semibold text-foreground">
              {v.rule_number} · {v.title}
            </p>
            <p className="text-muted-foreground">Flagged: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}</p>
          </div>
        ))}
    </div>
  );
}

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
    ["Brand", labels.brand(summary.brand_code)],
    [
      "Platforms",
      summary.platforms.length ? `${platformName(summary.platforms[0])}${summary.platforms.length > 1 ? ` +${summary.platforms.length - 1}` : ""}` : null,
    ],
    ["Audience", labels.audience(summary.audience)],
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
          can_review: sub.can_review,
          can_approve: sub.can_approve,
          approver_names: sub.approver_names,
          open_critical_flags: sub.open_critical_flags,
          score: isAnalysing(sub.latest_check) ? null : sub.latest_check?.score ?? null,
          manual_rules: sub.latest_check?.manual_review_rules,
        }}
      />
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
          <StagePill stage={stage} small />
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
              <CoverThumb cover={summary.cover} contentType={summary.content_type} caption={summary.caption_text} showPlay={false} />
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{media ? (mediaIsVideo ? "Video" : "Image") : CONTENT_TYPE_LABELS[summary.content_type] ?? "Content"}</span>
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
              check && isAnalysing(check)
                ? "Under review: still reading the post"
                : check
                ? `${check.score}/100 · ${check.blocked ? "Blocked" : check.is_compliant ? "No issues" : `${check.violations_count} issue${check.violations_count === 1 ? "" : "s"}`}`
                : "No results yet"
            }
            statusTone={
              !check ? undefined : check.traffic_light === "RED" ? "text-red-600 dark:text-red-400" : check.traffic_light === "YELLOW" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
            }
            description="Check regulatory, legal and brand messaging rules, audience, region and product-development stage."
            action={check ? (openCheck === "compliance" ? "Hide results" : "View results") : canRunCheck ? "Run compliance check" : null}
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
  const [platform, setPlatform] = useState("all");
  const [brand, setBrand] = useState("all");
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SubmissionSummary | null>(null);
  const [deleting, setDeleting] = useState<SubmissionSummary | null>(null);
  const isWide = useIsWide();
  const submit = useSubmitForReview();
  // Super admins, Content Managers and reviewers can switch to everyone's content.
  const { hasPermission, user, creatorView } = useAuth();
  const canSeeAll = hasPermission("CONTENT_SUBMISSIONS_VIEW") || hasPermission("CONTENT_REVIEW_APPROVE");
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
  });
  const { data: options } = useQuery({
    queryKey: ["submission-options"],
    queryFn: submissionService.getOptions,
    staleTime: 5 * 60_000,
  });
  const labels: Labels = useMemo(
    () => ({
      brand: (code) => (code ? options?.brands.find((b) => b.code === code)?.name ?? code : null),
      audience: (code) => (code ? options?.audiences[code] ?? code : null),
    }),
    [options]
  );

  // Creators see one month at a time, by when each post was first created.
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const onCurrentMonth = isSameMonth(month, new Date());
  const inView = useMemo(
    () => (gallery ? data.filter((s) => isSameMonth(new Date(s.created_at), month)) : data),
    [data, gallery, month]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { "": inView.length };
    for (const s of inView) {
      const st = stageOf(s);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [inView]);

  // Platform options come from what's actually in the list.
  const platformsInList = useMemo(() => [...new Set(data.flatMap((s) => s.platforms))].sort(), [data]);
  // The same brands, in the same order, as the brand picker on New Submission; plus any retired brand still on
  // older content, so it can be found.
  const brandsInList = useMemo(() => {
    const managed = (options?.brands ?? []).map((b) => b.code);
    const older = [...new Set(data.map((s) => s.brand_code).filter((c): c is string => Boolean(c) && !managed.includes(c!)))].sort();
    return [...managed, ...older];
  }, [options, data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = inView.filter(
      (s) =>
        (!stage || stageOf(s) === stage) &&
        (platform === "all" || s.platforms.includes(platform)) &&
        (brand === "all" || s.brand_code === brand) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.reference_code.toLowerCase().includes(q) ||
          (s.caption_text ?? "").toLowerCase().includes(q) ||
          accountsOf(s).some((a) => a.account_name.toLowerCase().includes(q)) ||
          (s.created_by_name ?? "").toLowerCase().includes(q))
    );
    return sortItems(filtered, prefs.sort);
  }, [inView, stage, platform, brand, search, prefs.sort]);

  // Wide screens always show something in the panel: the picked item, or the first one in the list.
  const picked = visible.find((s) => s.id === selectedId) ?? null;
  const selected = picked ?? (isWide && !gallery ? visible[0] ?? null : null);

  const filtersActive = Boolean(stage || search || platform !== "all" || brand !== "all");
  const clearFilters = () => {
    setStage("");
    setSearch("");
    setPlatform("all");
    setBrand("all");
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
    <div data-canvas={gallery ? "contrast" : "plain"} className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Content Portal</h1>
          {isReviewer && <p className="mt-1 text-sm text-muted-foreground">Review submitted content, run compliance checks, and manage approvals.</p>}
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
              <Plus className="w-4 h-4" /> New Submission
            </Link>
          </Button>
        </div>
      </header>

      {/* Status pills, each a filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {STAGE_FILTERS.map((f) => {
          const active = stage === f.value;
          return (
            <button
              key={f.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setStage(active && f.value ? "" : f.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-border/70 bg-card text-foreground hover:border-blue-300 hover:text-blue-700 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
              }`}
            >
              {f.label}
              <span className={`tabular-nums ${active ? "text-white/80" : "text-muted-foreground"}`}>{isLoading ? "–" : stageCounts[f.value] ?? 0}</span>
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
                <Button variant="outline" size="icon" className="h-8 w-8 bg-card" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-[120px] text-center text-sm font-semibold text-foreground" aria-live="polite">
                  {format(month, "MMMM yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-card"
                  onClick={() => setMonth(addMonths(month, 1))}
                  disabled={onCurrentMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                {!onCurrentMonth && (
                  <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} className="ml-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                    This month
                  </button>
                )}
              </div>
              <span>{isLoading ? "Loading..." : `${visible.length} ${visible.length === 1 ? "post" : "posts"}`}</span>
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
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search content..."
                  aria-label="Search content"
                  className="h-9 rounded-lg bg-card pl-9 text-xs"
                />
              </div>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-9 w-[140px] rounded-lg bg-card text-xs" aria-label="Platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                  {platformsInList.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {platformName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="h-9 w-[140px] rounded-lg bg-card text-xs" aria-label="Brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Brands</SelectItem>
                  {brandsInList.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {labels.brand(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stage || "all"} onValueChange={(v) => setStage(v === "all" ? "" : (v as Stage))}>
                <SelectTrigger className="h-9 w-[150px] rounded-lg bg-card text-xs" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  {(Object.keys(STAGES) as Stage[]).map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {STAGES[st].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {visible.map((s) => (
                  <GalleryCard key={s.id} s={s} onSelect={(item) => setSelectedId(item.id)} />
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
                <div className={`grid gap-2 ${isWide ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="h-9 w-full rounded-lg text-xs" aria-label="Platform">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                      {platformsInList.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {platformName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={brand} onValueChange={setBrand}>
                    <SelectTrigger className="h-9 w-full rounded-lg text-xs" aria-label="Brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Brands</SelectItem>
                      {brandsInList.map((b) => (
                        <SelectItem key={b} value={b} className="text-xs">
                          {labels.brand(b)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stage || "all"} onValueChange={(v) => setStage(v === "all" ? "" : (v as Stage))}>
                    <SelectTrigger className="h-9 w-full rounded-lg text-xs" aria-label="Status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                      {(Object.keys(STAGES) as Stage[]).map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">
                          {STAGES[st].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={prefs.sort} onValueChange={(v) => setPrefs({ sort: v as SortBy })}>
                    <SelectTrigger className="h-9 w-full rounded-lg text-xs" aria-label="Sort by">
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
