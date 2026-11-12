import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import ListPager from "@/components/common/ListPager";
import { usePaged } from "@/hooks/usePaged";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, endOfWeek, format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import MultiSelectFilter from "@/components/ui/MultiSelectFilter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import ReviewGlance, { type GlanceTile } from "@/components/submissions/ReviewGlance";
import { useSentiment } from "@/hooks/useSentiment";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import TopicTrend, { overallPostDecision } from "@/components/submissions/TopicTrend";
import ImageAnnotator from "@/components/submissions/ImageAnnotator";
import CommentComposer from "@/components/compliance/ScreenerCommentComposer";
import ReviewCommentsPanel, { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import PlatformCaptionsView from "@/components/submissions/PlatformCaptionsView";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import SourceChecks from "@/components/submissions/SourceChecks";
import {
  ContextNote,
  FINDING_META,
  FINDING_ORDER,
  FindingGroup,
  StatusPill,
  groupFindings,
  isWarning,
  statusOf,
} from "@/components/submissions/FindingStatus";
import {
  AI_UNAVAILABLE_MESSAGE,
  ANALYSING_REFETCH_MS,
  AnalysisProgressPanel,
  authedFileUrl,
  countdownText,
  isAnalysing,
  progressSteps,
  useAnalysisCountdown,
  audienceCodes,
  brandCodes,
  audienceNames,
} from "@/components/submissions/submissionUi";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { usePublicMood } from "@/hooks/usePublicMood";
import { useFlagReviews, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import { ResizablePanel } from "@/components/ui/ResizeHandle";
import type { ComplianceViolation } from "@/services/complianceService";
import type { FlagReview, QueueTab, ReviewQueueItem } from "@/types/submission";

// ---------------------------------------------------------------------------
// Queue: tabs, filters and the few facts each row needs
// ---------------------------------------------------------------------------

const TABS: { value: QueueTab; label: string }[] = [
  { value: "review", label: "To review" },
  { value: "sent_back", label: "Sent back" },
  { value: "done", label: "Done" },
];

const CONTENT_TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  VIDEO: { label: "Video", cls: "bg-muted text-muted-foreground" },
  SOCIAL_POST: { label: "Post", cls: "bg-muted text-muted-foreground" },
  CAROUSEL: { label: "Carousel", cls: "bg-muted text-muted-foreground" },
  IMAGE: { label: "Image", cls: "bg-muted text-muted-foreground" },
  BLOG: { label: "Article", cls: "bg-muted text-muted-foreground" },
  AD: { label: "Paid Ad", cls: "bg-muted text-muted-foreground" },
};

type DueFilter = "any" | "overdue" | "today" | "week" | "none";
type CheckFilter = "any" | "failing" | "critical" | "passing";
interface Filters {
  /** Brand codes and platforms to show; none picked means all. */
  brands: string[];
  platforms: string[];
  due: DueFilter;
  check: CheckFilter;
}
const NO_FILTERS: Filters = { brands: [], platforms: [], due: "any", check: "any" };
const COLLAPSE_KEY = "contentScreener.queueCollapsed";

const DUE_LABELS: Record<DueFilter, string> = {
  any: "Any deadline",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No deadline",
};
// The list is ordered by when each item was sent for review (deadlines have their own filter).
type SortOrder = "newest" | "oldest";
const SORT_LABELS: Record<SortOrder, string> = { newest: "Newest first", oldest: "Oldest first" };
const CHECK_LABELS: Record<CheckFilter, string> = {
  any: "Any result",
  failing: "Failing (red or under 60)",
  critical: "Has a critical flag",
  passing: "Passing",
};

const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
const scoreOf = (s: ReviewQueueItem) => (s.latest_check?.analysis_pending || s.latest_check?.ai_unavailable ? null : s.latest_check?.score ?? null);
const isFailing = (s: ReviewQueueItem) => {
  const score = scoreOf(s);
  return s.latest_check?.traffic_light === "RED" || (score != null && score < 60);
};
const hasCritical = (s: ReviewQueueItem) => (s.open_critical_flags ?? 0) > 0;
/** The deadline that matters on this tab: the reviewer's (or the creator's, when sent back). */
const deadlineOf = (s: ReviewQueueItem) => (s.due_at ? new Date(s.due_at) : null);

function matches(s: ReviewQueueItem, f: Filters, q: string) {
  const due = deadlineOf(s);
  const now = new Date();
  return (
    (f.brands.length === 0 || brandCodes(s).some((c) => f.brands.includes(c))) &&
    (f.platforms.length === 0 || s.platforms.some((p) => f.platforms.includes(p))) &&
    (f.due === "any" ||
      (f.due === "none" && !due) ||
      (f.due === "overdue" && Boolean(due && isPast(due))) ||
      (f.due === "today" && Boolean(due && !isPast(due) && due <= endOfDay(now))) ||
      (f.due === "week" && Boolean(due && !isPast(due) && due <= endOfWeek(now, { weekStartsOn: 1 })))) &&
    (f.check === "any" ||
      (f.check === "failing" && isFailing(s)) ||
      (f.check === "critical" && hasCritical(s)) ||
      (f.check === "passing" && !isFailing(s) && !hasCritical(s) && scoreOf(s) != null)) &&
    (!q || s.title.toLowerCase().includes(q) || s.reference_code.toLowerCase().includes(q) || (s.creator_name ?? "").toLowerCase().includes(q))
  );
}

/** "Overdue 2 days" / "Due today, 5:00 PM" / "Due Fri, Oct 30", coloured by urgency. */
function dueText(s: ReviewQueueItem, tab: QueueTab): { text: string; tone: string } {
  const muted = "text-muted-foreground";
  if (tab === "done") {
    const when = s.decided_at ? format(new Date(s.decided_at), "MMM d") : "";
    return { text: `${s.status === "APPROVED" ? "Approved" : "Decided"} ${when}`.trim(), tone: muted };
  }
  const due = deadlineOf(s);
  if (!due) return { text: "No deadline", tone: muted };
  const who = tab === "sent_back" ? "Creator " : "";
  if (isPast(due)) return { text: `${who}overdue ${formatDistanceToNow(due)}`, tone: tab === "review" ? "text-red-700/80 dark:text-red-300/80" : muted };
  if (isToday(due)) return { text: `${who}due today, ${format(due, "h:mm a")}`, tone: tab === "review" ? "text-amber-700 dark:text-amber-400" : muted };
  return { text: `${who}due ${format(due, "EEE, MMM d")}`, tone: muted };
}

/** "Checking · ~35 s" while the post is still being read. */
function CheckingBadge({ s }: { s: ReviewQueueItem }) {
  const countdown = useAnalysisCountdown(s.analysis_progress);
  return (
    <span
      className="whitespace-nowrap rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground"
      title={s.analysis_progress ? progressSteps(s.analysis_progress) : undefined}
    >
      Checking{countdown && ` · ${countdownText(countdown, true)}`}
    </span>
  );
}

function ScoreBadge({ s }: { s: ReviewQueueItem }) {
  const score = scoreOf(s);
  if (score == null) return <CheckingBadge s={s} />;
  // A quiet chip with a coloured dot, rather than a bright filled pill.
  const dot = score >= 80 && !hasCritical(s) ? "bg-emerald-500" : score >= 60 && !hasCritical(s) ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {score}
    </span>
  );
}

function Thumb({ s }: { s: ReviewQueueItem }) {
  const image = s.images?.[0];
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {s.video ? (
        // A frame a second in: many videos open on black.
        <video src={`${authedFileUrl(s.video.url)}#t=1`} preload="metadata" muted className="h-full w-full object-cover" />
      ) : image ? (
        <img src={authedFileUrl(image.url)} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">Text</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flags: where each rulebook finding is, and when in the video
// ---------------------------------------------------------------------------

interface Flag {
  v: ComplianceViolation;
  critical: boolean;
  /** The part of the video it was found in (first one), if it was found in the video. */
  at: number | null;
  end: number | null;
  where: string;
}

function flagsOf(s: ReviewQueueItem): Flag[] {
  const check = s.latest_check;
  if (!check) return [];
  const caption = (s.caption_text ?? "").toLowerCase();
  const title = s.title.toLowerCase();
  return (check.violations ?? [])
    .map((v) => {
      const seg = (check.segment_flags ?? [])
        .filter((f) => f.rule_numbers.includes(v.rule_number))
        .sort((a, b) => a.start_sec - b.start_sec)[0];
      const terms = v.flagged_terms.map((t) => t.toLowerCase());
      const where = terms.some((t) => caption.includes(t))
        ? "Caption"
        : seg
        ? "Video"
        : terms.some((t) => title.includes(t))
        ? "Title"
        : v.kind === "MISSING_DISCLAIMER"
        ? "Missing disclaimer"
        : "Image or on-screen text";
      return { v, critical: v.traffic_light === "RED", at: seg ? seg.start_sec : null, end: seg ? seg.end_sec : null, where };
    })
    .sort((a, b) => Number(b.critical) - Number(a.critical) || (a.at ?? 1e9) - (b.at ?? 1e9));
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The caption with every flagged phrase highlighted. */
export function HighlightedCaption({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** One flagged phrase in the caption: which rule found it, and whether it was dismissed. */
interface MarkedTerm {
  term: string;
  ruleId: string;
  dismissed: boolean;
}

/**
 * The caption with its flagged wording marked: amber for an open flag, purple and dashed for one that was dismissed.
 * Clicking marked wording opens that flag in the panel; clicking anything else opens a comment.
 */
function MarkedCaption({
  text,
  terms,
  picked,
  onFlag,
  onComment,
}: {
  text: string;
  terms: MarkedTerm[];
  picked: string | null;
  onFlag: (ruleId: string) => void;
  onComment: () => void;
}) {
  const byTerm = new Map(terms.map((t) => [t.term.toLowerCase(), t]));
  const pieces = terms.length
    ? text.split(new RegExp(`(${[...byTerm.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join("|")})`, "gi"))
    : [text];
  return (
    <>
      {pieces.map((part, i) => {
        const hit = i % 2 ? byTerm.get(part.toLowerCase()) : undefined;
        if (!hit) {
          return (
            <span key={i} onClick={onComment} className="cursor-text rounded hover:bg-blue-50 dark:hover:bg-blue-500/10">
              {part}
            </span>
          );
        }
        return (
          <mark
            key={i}
            onClick={() => onFlag(hit.ruleId)}
            title={hit.dismissed ? "Dismissed: click to see why" : "Click to see the flag"}
            className={`cursor-pointer rounded px-0.5 text-foreground ${
              hit.dismissed
                ? "border-b-2 border-dashed border-violet-500 bg-violet-200/60 dark:bg-violet-500/30"
                : "bg-amber-200/70 dark:bg-amber-500/30"
            } ${picked === hit.ruleId ? "ring-2 ring-violet-500" : ""}`}
          >
            {part}
          </mark>
        );
      })}
    </>
  );
}

/** Platforms whose videos are usually vertical: the frame's shape until the video's real shape is known. */
const VERTICAL_PLATFORMS = ["TIKTOK", "INSTAGRAM", "YOUTUBE_SHORTS"];

interface TimelinePart {
  start: number;
  end: number;
  risk: "RED" | "YELLOW" | "GREEN";
}

/** The video split into its checked parts, each coloured by what was found there. A part covering the whole video
 * (the title and caption check) is left out when there are finer parts. */
export function timelineOf(s: Pick<ReviewQueueItem, "latest_check">, duration: number): TimelinePart[] {
  const segs = s.latest_check?.segment_flags ?? [];
  const total = duration || Math.max(0, ...segs.map((f) => f.end_sec));
  if (!total) return [];
  const fine = segs.filter((f) => f.end_sec - f.start_sec < total * 0.95);
  return (fine.length ? fine : segs)
    .filter((f) => f.start_sec < total)
    .map((f) => ({ start: f.start_sec, end: Math.min(f.end_sec, total), risk: f.traffic_light }))
    .sort((a, b) => a.start - b.start);
}

/** "Flagged Moments": the video's parts as a coloured bar with play controls, a legend and flagged times. */
export function FlaggedMoments({
  parts,
  now,
  duration,
  playing,
  onToggle,
  onStep,
  seek,
}: {
  parts: TimelinePart[];
  now: number;
  duration: number;
  playing: boolean;
  onToggle: () => void;
  onStep: (by: number) => void;
  seek: (t: number) => void;
}) {
  const count = (r: TimelinePart["risk"]) => parts.filter((p) => p.risk === r).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Flagged moments
          <span className="hidden font-normal text-muted-foreground sm:inline">(click the bar or press play to preview)</span>
        </span>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-red-600" /> Critical ({count("RED")})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-amber-500" /> Needs review ({count("YELLOW")})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Clear ({count("GREEN")})
          </span>
        </div>
      </div>
      <div className="flex items-start gap-1.5 sm:gap-2.5">
        <Button type="button" size="icon" variant="ghost" onClick={() => onStep(-1)} className="hidden h-8 w-8 shrink-0 text-muted-foreground sm:inline-flex" title="Back 1 second">
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button type="button" size="icon" onClick={onToggle} className="-mt-0.5 h-9 w-9 shrink-0 rounded-full" title={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="ml-0.5 w-4 h-4 fill-current" />}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onStep(1)} className="hidden h-8 w-8 shrink-0 text-muted-foreground sm:inline-flex" title="Forward 1 second">
          <SkipForward className="w-4 h-4" />
        </Button>
        <span className="min-w-[34px] shrink-0 text-right font-mono text-xs font-bold leading-8 text-foreground">{formatSec(now)}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="relative h-8 select-none">
            <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-muted" />
            {duration > 0 &&
              parts.map((p, i) => (
                <div
                  key={i}
                  style={{ left: `${(p.start / duration) * 100}%`, width: `calc(${((p.end - p.start) / duration) * 100}% - 3px)` }}
                  className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${
                    p.risk === "RED" ? "bg-red-600" : p.risk === "YELLOW" ? "bg-amber-500" : "bg-emerald-500/80"
                  }`}
                />
              ))}
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.01}
              value={Math.min(now, duration || 1)}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
              aria-label="Seek video"
            />
            {duration > 0 && (
              <div
                style={{ left: `${(Math.min(now, duration) / duration) * 100}%` }}
                className="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              >
                <div className="flex h-6 w-2.5 items-center justify-center rounded-full bg-zinc-950 shadow-md ring-2 ring-background dark:bg-zinc-100">
                  <div className="h-3 w-0.5 rounded-full bg-zinc-500" />
                </div>
              </div>
            )}
          </div>
          <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
            {duration > 0 &&
              parts
                .filter((p) => p.start > 0 && p.start / duration < 0.92)
                // Labels need room: skip one that would sit on top of the last shown, unless it's a critical part.
                .reduce<TimelinePart[]>((shown, p) => {
                  const last = shown[shown.length - 1];
                  if (!last || p.risk === "RED" || (p.start - last.start) / duration >= 0.08) shown.push(p);
                  return shown;
                }, [])
                .map((p, i) => (
                  <span
                    key={i}
                    style={{ left: `${(p.start / duration) * 100}%` }}
                    className={`absolute hidden -translate-x-1/2 sm:block ${p.risk === "RED" ? "font-semibold text-red-600 dark:text-red-400" : ""}`}
                  >
                    {formatSec(p.start)}
                  </span>
                ))}
          </div>
        </div>
        <span className="min-w-[34px] shrink-0 font-mono text-xs leading-8 text-muted-foreground">{formatSec(duration)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The post: header, media (vertical for reels), flagged moments, the comment box, caption
// ---------------------------------------------------------------------------

function PostView({
  s,
  flags,
  dismissed,
  labels,
  videoRef,
  now,
  duration,
  playing,
  picked,
  onFlag,
  onComment,
  onTime,
  onDuration,
  onPlaying,
  seek,
  onUploadScript,
  canComment,
  activeCommentId,
  onActiveComment,
}: {
  s: ReviewQueueItem;
  flags: Flag[];
  dismissed: Set<string>;
  labels: { brand: (c?: string | null) => string | null; brands: (codes: string[]) => string | null; audience: (codes: string[]) => string | null };
  videoRef: RefObject<HTMLVideoElement | null>;
  now: number;
  duration: number;
  playing: boolean;
  picked: string | null;
  onFlag: (ruleId: string) => void;
  onComment: () => void;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
  onPlaying: (p: boolean) => void;
  seek: (t: number) => void;
  onUploadScript?: () => void;
  /** May leave comments, including on an area of an image. */
  canComment: boolean;
  activeCommentId: string | null;
  onActiveComment: (id: string | null) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = s.images ?? [];
  const image = images[Math.min(imageIndex, images.length - 1)];
  const { comments: allComments } = useReviewComments(s.id);
  // A comment picked in the list shows its image.
  useEffect(() => {
    const c = allComments.find((x) => x.id === activeCommentId);
    const at = c?.file_id ? images.findIndex((i) => i.id === c.file_id) : -1;
    if (at >= 0) setImageIndex(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCommentId]);
  const account = s.account;
  const needBy = s.approval_needed_by ? new Date(s.approval_needed_by) : null;
  // The frame takes the uploaded video's own shape (width / height), read when it loads. Until then, a guess from
  // the platform: reels, TikToks and Shorts are usually vertical.
  const [ratio, setRatio] = useState<number | null>(null);
  const shape = ratio ?? (s.platforms.some((p) => VERTICAL_PLATFORMS.includes(p)) ? 9 / 16 : 16 / 9);
  // Portrait and square videos are sized by height so they don't fill the screen; landscape ones by width.
  const tall = shape < 1.25;
  const timed = flags.filter((f) => f.at != null);
  const parts = timelineOf(s, duration);
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const step = (by: number) => seek(Math.min(Math.max(0, now + by), duration || now + by));
  const terms: MarkedTerm[] = flags.flatMap((f) =>
    f.v.flagged_terms.filter(Boolean).map((term) => ({ term, ruleId: f.v.rule_id, dismissed: dismissed.has(f.v.rule_id) }))
  );
  // The most serious open flag at this moment, shown over the video.
  const atFlag = timed
    .filter((f) => Math.abs(now - f.at!) < 0.75 && !dismissed.has(f.v.rule_id))
    .sort((a, b) => Number(b.critical) - Number(a.critical))[0];

  const chip = "rounded-md bg-muted px-2 py-0.5 text-xs text-foreground/80";
  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex flex-col gap-2 border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug text-foreground">{s.title}</h2>
            <p className="text-sm text-muted-foreground">
              {s.reference_code} · Version {s.current_version}
              {s.creator_name && ` · by ${s.creator_name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onUploadScript && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-500/10"
                onClick={onUploadScript}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" /> Upload script
              </Button>
            )}
            {s.script_status && s.script_status !== "DRAFT" && (
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Link to={`/submissions/${s.id}/script`}>
                  <FileText className="w-3.5 h-3.5" /> View script
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.platforms.map((p) => (
            <span key={p} className={`${chip} inline-flex items-center gap-1`}>
              <PlatformIcon platform={p as SocialPlatform} className="w-3 h-3" /> {platformName(p)}
              {p === s.platforms[0] && account?.handle ? ` · @${account.handle.replace(/^@/, "")}` : ""}
            </span>
          ))}
          {labels.brands(brandCodes(s)) && <span className={chip}>{labels.brands(brandCodes(s))}</span>}
          {labels.audience(audienceCodes(s)) && <span className={chip}>{labels.audience(audienceCodes(s))}</span>}
          {needBy && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                isPast(needBy) && s.status === "IN_REVIEW"
                  ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                  : "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
              }`}
            >
              Approval needed by {format(needBy, "EEE, MMM d · h:mm a")}
              {isPast(needBy) && s.status === "IN_REVIEW" && ` · overdue ${formatDistanceToNow(needBy)}`}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-5 min-[112.5rem]:max-w-[1000px]">
        {s.video ? (
          <>
            {/* The frame matches the video's own shape: vertical reels stay vertical, landscape stays wide */}
            <div
              className={`relative mx-auto max-w-full overflow-hidden rounded-xl bg-black ${tall ? "h-[min(50vh,500px)] min-[112.5rem]:h-[min(60vh,680px)]" : "w-full max-w-[640px] min-[112.5rem]:max-w-[900px]"}`}
              style={{ aspectRatio: shape }}
            >
              <video
                key={s.video.id}
                ref={videoRef}
                src={authedFileUrl(s.video.url)}
                controls
                playsInline
                className="h-full w-full bg-black object-contain"
                onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  onDuration(v.duration || 0);
                  if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
                }}
                onPlay={() => onPlaying(true)}
                onPause={() => onPlaying(false)}
                onEnded={() => onPlaying(false)}
              />
              {atFlag && (
                <span className="pointer-events-none absolute inset-x-3 top-3 rounded-md bg-black/75 px-2.5 py-1 text-xs text-white">
                  {atFlag.critical ? "Critical" : "Needs review"} · {atFlag.v.rule_number} · {atFlag.v.title}
                </span>
              )}
            </div>

            <FlaggedMoments parts={parts} now={now} duration={duration} playing={playing} onToggle={toggle} onStep={step} seek={seek} />
          </>
        ) : image ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-center">
              <ImageAnnotator
                key={image.id}
                imageClassName="max-h-[60vh] w-auto rounded-xl object-contain shadow-md ring-1 ring-border/60"
                submissionId={s.id}
                file={image}
                canDraw={canComment}
                activeId={activeCommentId}
                onActive={onActiveComment}
                onPlainClick={onComment}
              />
            </div>
            {canComment && (
              <p className="text-xs text-muted-foreground">
                Drag over the part of the image you mean to comment on it, or use the box on the right for a general comment.
              </p>
            )}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Image ${i + 1}`}
                    aria-pressed={i === imageIndex}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${i === imageIndex ? "border-blue-600" : "border-transparent"}`}
                  >
                    <img src={authedFileUrl(img.url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Caption</span>
            <span className="text-xs text-muted-foreground">Click marked wording to see its flag, or anything else to comment</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {s.caption_text ? (
              <MarkedCaption text={s.caption_text} terms={terms} picked={picked} onFlag={onFlag} onComment={onComment} />
            ) : (
              <span className="text-muted-foreground">No caption.</span>
            )}
          </p>
        </div>
        <PlatformCaptionsView platforms={s.platforms} captions={s.platform_captions} mainCaption={s.caption_text} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel: score, flags / sentiment / comments / script, and the decision
// ---------------------------------------------------------------------------

/** How the sentiment analysis read, in a word, for the glance tile. */
const SENTIMENT_TILE: Record<string, { label: string; tone: GlanceTile["tone"] }> = {
  NO_CONCERNS: { label: "No concerns", tone: "ok" },
  REVIEW_SUGGESTED: { label: "Review suggested", tone: "warn" },
  SIGNIFICANT_CONCERNS: { label: "Concerns", tone: "bad" },
  INSUFFICIENT_INFORMATION: { label: "Not enough to judge", tone: "muted" },
};

type PanelTab = "comments" | "compliance" | "sentiment" | "mood" | "script";

function ReviewPanel({
  s,
  flags,
  dismissed,
  reviews,
  canReview,
  now,
  hasVideo,
  seek,
  tab,
  setTab,
  seen,
  picked,
  setPicked,
  activeComment,
  setActiveComment,
}: {
  s: ReviewQueueItem;
  flags: Flag[];
  dismissed: Set<string>;
  /** Who dismissed each dismissed flag on this version, and why. */
  reviews: Map<string, FlagReview>;
  canReview: boolean;
  now: number;
  hasVideo: boolean;
  seek: (t: number) => void;
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  /** The tabs the reviewer has opened on this post. */
  seen: Set<PanelTab>;
  picked: string | null;
  setPicked: (ruleId: string | null) => void;
  /** The comment picked on the image, and the way to pick one from the list. */
  activeComment: string | null;
  setActiveComment: (id: string | null) => void;
}) {
  const { comments } = useReviewComments(s.id);
  const { analysis: sentiment } = useSentiment(s.id);
  const { mood, isLoading: moodLoading, dismissTopic, hasRun: moodHasRun, run: runMood } = usePublicMood(s.id, true);
  // A suggesting reviewer comments but doesn't decide.
  const { isSuggester } = useAuth();
  const canComment = (canReview || isSuggester) && s.status === "IN_REVIEW";
  // A flag picked on the post scrolls into view in the panel.
  useEffect(() => {
    if (picked && tab === "compliance") document.getElementById(`flag-${picked}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [picked, tab]);
  const moodDecision = overallPostDecision(mood);
  const check = s.latest_check;
  const score = scoreOf(s);
  // Open: still needs attention. Cleared triggers don't; violations cost points, the rest are warnings.
  const open = flags.filter((f) => !dismissed.has(f.v.rule_id) && statusOf(f.v) !== "CLEARED");
  const openViolations = open.filter((f) => statusOf(f.v) === "VIOLATION");
  const toCheck = open.filter((f) => statusOf(f.v) === "NEEDS_REVIEW").length;
  const needSource = open.filter((f) => statusOf(f.v) === "EVIDENCE_REQUIRED").length;
  const cleared = flags.filter((f) => statusOf(f.v) === "CLEARED").length;
  // What was dismissed is shown first and set apart; the rest are grouped by what they are.
  const dismissedFlags = flags.filter((f) => dismissed.has(f.v.rule_id));
  const grouped = groupFindings(
    flags.filter((f) => !dismissed.has(f.v.rule_id)),
    (f) => statusOf(f.v)
  );
  const openCritical = openViolations.filter((f) => f.critical).length;
  const manual = check?.manual_review_rules ?? [];
  const transcript = [...(s.video?.transcript ?? [])].sort((a, b) => a.start_sec - b.start_sec);

  const verdict =
    check?.ai_unavailable
      ? { text: "No score yet", tone: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-500/50" }
      : score == null
      ? { text: "Still checking", tone: "text-muted-foreground", ring: "border-muted" }
      : openCritical
      ? { text: "Needs changes", tone: "text-red-700 dark:text-red-400", ring: "border-red-300 dark:border-red-500/50" }
      : openViolations.length
      ? { text: "Review suggested", tone: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-500/50" }
      : open.length
      ? { text: "Check before publishing", tone: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-500/50" }
      : { text: "Ready to approve", tone: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-300 dark:border-emerald-500/50" };

  // The four things a reviewer looks at, each with its one-line answer.
  const sentimentRead = sentiment?.status === "COMPLETED" && sentiment.result ? SENTIMENT_TILE[sentiment.result.overall_assessment] : null;
  const sentimentBusy = sentiment ? ["PENDING", "PROCESSING", "WAITING_TRANSCRIPT", "SCHEDULED"].includes(sentiment.status) : false;
  const scoreTone: GlanceTile["tone"] = check?.ai_unavailable || score == null ? "muted" : openCritical ? "bad" : score >= 80 ? "ok" : score >= 60 ? "warn" : "bad";
  const tiles: GlanceTile[] = [
    {
      key: "compliance",
      label: "Compliance",
      value: check?.ai_unavailable ? "No score" : score == null ? "Checking" : `${score}/100`,
      sub: openCritical
        ? `${openCritical} critical flag${openCritical === 1 ? "" : "s"} open`
        : [open.length ? `${open.length} open` : "Nothing open", dismissedFlags.length ? `${dismissedFlags.length} dismissed` : ""].filter(Boolean).join(" · "),
      tone: scoreTone,
      seen: seen.has("compliance"),
    },
    {
      key: "sentiment",
      label: "Sentiment",
      value: sentimentRead?.label ?? (sentimentBusy ? "Running" : "Not run"),
      sub: sentimentRead ? "Run by the creator" : sentimentBusy ? "Will appear here" : "The creator hasn't run it",
      tone: sentimentRead?.tone ?? "muted",
      seen: seen.has("sentiment"),
    },
    {
      key: "mood",
      label: "Public mood",
      value: moodDecision ? moodDecision.recommendation : moodLoading ? "Loading" : "No data",
      sub: moodDecision ? moodDecision.reason : mood?.topics.length ? `${mood.topics.length} topic${mood.topics.length === 1 ? "" : "s"}` : "Nothing matched",
      tone: moodDecision ? (moodDecision.recommendation === "POST" ? "ok" : moodDecision.recommendation === "WAIT" ? "warn" : "bad") : "muted",
      seen: seen.has("mood"),
    },
    {
      key: "comments",
      label: canComment ? "Your input" : "Comments",
      value: canComment ? (comments.length ? `Comments (${comments.length})` : "Comments") : comments.length ? String(comments.length) : "None",
      sub: canComment
        ? comments.length
          ? "Add more suggestions as needed"
          : "Suggestions, notes, anything to change"
        : comments.length
        ? "Left on this post"
        : "None were left",
      tone: "muted",
      seen: seen.has("comments"),
      highlight: canComment,
    },
  ];
  const toLookAt = tiles.filter((t) => !t.seen && t.key !== "comments").map((t) => t.label);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewGlance
        tiles={tiles}
        active={tab}
        onPick={(key) => setTab(key as PanelTab)}
        extra={hasVideo ? [{ key: "script", label: `Transcript${transcript.length ? ` (${transcript.length})` : ""}` }] : undefined}
      />

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {tab === "compliance" && (
        <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] ${verdict.ring}`}>
            <span className="text-center leading-none">
              <span className="block text-xl font-bold tabular-nums text-foreground">{score ?? "–"}</span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[15px] font-semibold ${verdict.tone}`}>{verdict.text}</p>
            {check?.ai_unavailable ? (
              <p className="text-sm text-muted-foreground">{AI_UNAVAILABLE_MESSAGE}</p>
            ) : score == null && s.analysis_progress ? (
              // Still reading the post: what's left and how long, instead of a flag count that isn't final yet.
              <AnalysisProgressPanel progress={s.analysis_progress} className="mt-1" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {openViolations.length} open flag{openViolations.length === 1 ? "" : "s"}
                {openCritical > 0 && ` · ${openCritical} critical`}
                {toCheck > 0 && ` · ${toCheck} to check`}
                {needSource > 0 && ` · ${needSource} need${needSource === 1 ? "s" : ""} a source`}
                {flags.length - open.length - cleared > 0 && ` · ${flags.length - open.length - cleared} dismissed`}
                {cleared > 0 && ` · ${cleared} cleared by context`}
              </p>
            )}
            {check?.rules_checked != null && (
              <p className="text-xs text-muted-foreground">
                {check.rules_checked - manual.length} of {check.rules_checked} rules checked automatically
              </p>
            )}
            <SourceChecks checks={check?.source_checks} />
          </div>
        </div>
        )}
        {tab === "compliance" && dismissedFlags.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <p className="text-[13px] font-bold text-violet-800 dark:text-violet-300">Dismissed ({dismissedFlags.length})</p>
            {dismissedFlags.map((f) => {
              const r = reviews.get(f.v.rule_id);
              return (
                <article
                  key={f.v.rule_id}
                  id={`flag-${f.v.rule_id}`}
                  onClick={() => {
                    setPicked(f.v.rule_id);
                    if (f.at != null) seek(f.at);
                  }}
                  className={`flex cursor-pointer flex-col gap-2 rounded-xl border-2 border-dashed border-violet-500 bg-violet-50/60 p-3.5 dark:bg-violet-500/10 ${
                    picked === f.v.rule_id ? "ring-2 ring-violet-500/50" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
                      Dismissed{r?.decided_by_name ? ` by ${r.decided_by_name}` : ""}
                    </span>
                    {f.at != null && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatSec(f.at)}
                      </span>
                    )}
                    <RuleNumberBadge v={f.v} />
                    <span className="ml-auto text-xs text-muted-foreground">{f.where}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{f.v.title}</p>
                  {f.v.flagged_terms.length > 0 && (
                    <p className="rounded-lg bg-background/80 px-2.5 py-1.5 text-[13px] text-foreground">
                      {f.v.flagged_terms.map((t) => `“${t}”`).join(", ")}
                    </p>
                  )}
                  {r && (
                    <p className="rounded-lg border border-violet-200 bg-background px-2.5 py-2 text-[13px] text-foreground/90 dark:border-violet-500/30">
                      <span className="font-semibold text-violet-800 dark:text-violet-300">Reason:</span> {r.reason_label}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  )}
                  <FlagReviewControl
                    submissionId={s.id}
                    currentVersion={s.current_version}
                    ruleId={f.v.rule_id}
                    ruleNumber={f.v.rule_number}
                    canDismiss={canReview}
                    evidence={statusOf(f.v) === "EVIDENCE_REQUIRED"}
                  />
                </article>
              );
            })}
          </section>
        )}
        {tab === "compliance" &&
          (flags.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto w-7 h-7 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-foreground">No rulebook flags</p>
              <p className="text-xs text-muted-foreground">{score == null ? "The check is still reading this post." : "Nothing in this post broke a rule."}</p>
            </div>
          ) : (
            <>
              {FINDING_ORDER.map((status) => (
                <FindingGroup key={status} status={status} count={grouped[status].length}>
              {grouped[status].map((f) => {
                const selected = picked === f.v.rule_id || (f.at != null && Math.abs(now - f.at) < 0.75);
                const jump = () => {
                  setPicked(f.v.rule_id);
                  if (f.at != null) seek(f.at);
                };
                return (
                  <article
                    key={f.v.rule_id}
                    id={`flag-${f.v.rule_id}`}
                    // The whole card jumps the video to where it was found (as on the previous screener).
                    onClick={jump}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        jump();
                      }
                    }}
                    tabIndex={0}
                    aria-label={f.at != null ? `${f.v.rule_number}: jump to ${formatSec(f.at)}` : f.v.rule_number}
                    className={`flex flex-col gap-2 rounded-xl border p-3.5 transition-colors ${
                      "cursor-pointer"
                    } ${
                      selected
                        ? "ring-2 ring-blue-500/50"
                        : ""
                    } ${
                      f.critical ? "border-red-500/30 bg-red-500/5 hover:border-red-500/60" : FINDING_META[statusOf(f.v)].card
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={statusOf(f.v)} critical={f.critical} />
                      {f.at != null && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatSec(f.at)}
                          {f.end != null && f.end > f.at + 0.5 && ` - ${formatSec(f.end)}`}
                        </span>
                      )}
                      <RuleNumberBadge v={f.v} />
                      <span className="ml-auto text-xs text-muted-foreground">{f.where}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{f.v.title}</p>
                    {f.v.flagged_terms.length > 0 && (
                      <p className="rounded-lg bg-muted px-2.5 py-1.5 text-[13px] text-foreground">
                        {f.v.flagged_terms.map((t) => `“${t}”`).join(", ")}
                      </p>
                    )}
                    <ContextNote v={f.v} />
                    {f.v.kind === "MISSING_DISCLAIMER" && f.v.missing_disclaimers?.[0] && statusOf(f.v) !== "CLEARED" && (
                      <p className="text-[13px] text-foreground/80">
                        <span className="font-semibold">Needs:</span> “{f.v.missing_disclaimers[0]}”
                      </p>
                    )}
                    {f.v.remediation_guidance && statusOf(f.v) !== "CLEARED" && (
                      <p className="text-[13px] text-foreground/80">
                        <span className="font-semibold">{isWarning(f.v) ? "What to check:" : "Suggested fix:"}</span> {f.v.remediation_guidance}
                      </p>
                    )}
                    {statusOf(f.v) !== "CLEARED" && (
                      <FlagReviewControl
                        submissionId={s.id}
                        currentVersion={s.current_version}
                        ruleId={f.v.rule_id}
                        ruleNumber={f.v.rule_number}
                        canDismiss={canReview}
                        evidence={statusOf(f.v) === "EVIDENCE_REQUIRED"}
                      />
                    )}
                  </article>
                );
              })}
                </FindingGroup>
              ))}
            </>
          ))}
        {tab === "compliance" && manual.length > 0 && (
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="text-sm font-semibold text-foreground">Check by hand</p>
            <p className="mb-2 text-xs text-muted-foreground">The text check can't test these. You confirm them when you approve.</p>
            <ul className="flex flex-col gap-1 text-[13px] text-foreground/80">
              {manual.map((r) => (
                <li key={r.rule_number}>
                  <RuleNumberBadge v={r} /> {r.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "sentiment" && <SentimentPanel key={s.id} submissionId={s.id} canRun={canReview} onSeek={seek} showTopicTrends={false} />}

        {tab === "mood" && (
          <TopicTrend
            submissionId={s.id}
            mood={mood}
            isLoading={moodLoading}
            canEdit={canReview}
            busy={dismissTopic.isPending}
            onDismiss={(topicId) => dismissTopic.mutate({ topicId })}
            onRestore={(topicId) => dismissTopic.mutate({ topicId, restore: true })}
            hasRun={moodHasRun}
            onRun={() => runMood()}
          />
        )}

        {tab === "comments" && canComment && (
          <div className="rounded-xl border-2 border-blue-600 bg-blue-50/40 p-3 dark:border-blue-400 dark:bg-blue-500/10">
            <p className="text-sm font-semibold text-foreground">Leave a comment or suggestion</p>
            <p className="mb-2.5 text-xs text-muted-foreground">
              Write it here, or click the part of the post it's about. The creator sees every comment with the decision.
            </p>
            <CommentComposer s={s} now={now} hasVideo={hasVideo} />
          </div>
        )}
        {tab === "comments" && !canComment && s.status !== "IN_REVIEW" && (
          <p className="text-xs text-muted-foreground">This was decided, so its notes are read-only. To raise something new, reopen it for changes.</p>
        )}
        {tab === "comments" && (
          <ReviewCommentsPanel
            submissionId={s.id}
            canComment={canReview || isSuggester}
            currentTime={hasVideo ? now : undefined}
            onSeek={seek}
            activeCommentId={activeComment}
            onShowRegion={(c) => setActiveComment(activeComment === c.id ? null : c.id)}
            showHeader={false}
            showComposer={false}
            emptyText="No comments yet. Add a suggestion above if anything should change."
          />
        )}

        {tab === "script" &&
          (s.video?.transcript_status && s.video.transcript_status !== "COMPLETED" ? (
            <p className="text-sm text-muted-foreground">
              {s.video.transcript_status === "FAILED" ? "The transcript couldn't be made for this video." : "The transcript is being prepared..."}
            </p>
          ) : transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing was said or shown as text in this video.</p>
          ) : (
            transcript.map((seg, i) => (
              <button
                key={i}
                type="button"
                onClick={() => seek(seg.start_sec)}
                className={`flex gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted ${
                  now >= seg.start_sec && now < seg.end_sec ? "bg-muted" : ""
                }`}
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatSec(seg.start_sec)}</span>
                <span className="text-[13px] text-foreground">
                  {seg.source === "on_screen" && <span className="mr-1 text-xs text-muted-foreground">[on screen]</span>}
                  {seg.text}
                </span>
              </button>
            ))
          ))}
      </div>

      {/* Decision: always in view */}
      <div className="border-t border-border/70 bg-muted/30 p-4">
        {s.status === "IN_REVIEW" && canReview && (
          <p className={`mb-3 text-xs ${toLookAt.length ? "text-muted-foreground" : "font-medium text-emerald-700 dark:text-emerald-300"}`} aria-live="polite">
            {toLookAt.length ? `Still to look at: ${toLookAt.join(", ")}` : "You've looked at everything. Ready to decide."}
          </p>
        )}
        {s.status === "IN_REVIEW" ? (
          canReview ? (
            <ReviewDecisionPanel
              layout="bar"
              target={{
                id: s.id,
                reference_code: s.reference_code,
                title: s.title,
                status: s.status,
                current_version: s.current_version,
                platforms: s.platforms,
                publish_at: s.publish_at,
                can_delegate: s.can_delegate,
                brand_code: s.brand_code,
                brand_codes: s.brand_codes,
                reviewer_ids: s.reviewer_ids,
                created_by: s.created_by,
                due_at: s.due_at,
                due_kind: s.due_kind,
                ai_unavailable: s.latest_check?.ai_unavailable,
                analysis_pending: isAnalysing(s.latest_check),
                can_review: s.can_review,
                can_approve: s.can_approve,
                approver_names: s.approver_names,
                open_critical_flags: s.open_critical_flags,
                approval_score: s.approval_score,
                min_approval_score: s.min_approval_score,
                score: s.latest_check?.score ?? null,
                manual_rules: manual,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isSuggester
                ? "You're a suggesting reviewer: comment on it, and a reviewer decides."
                : "Waiting for a reviewer's decision."}
            </p>
          )
        ) : s.status === "APPROVED" && s.can_manage_approval ? (
          <ApprovalActions
            target={{
              id: s.id,
              reference_code: s.reference_code,
              title: s.title,
              status: s.status,
              current_version: s.current_version,
              publish_at: s.publish_at,
              can_manage_approval: s.can_manage_approval,
            }}
            isCreator={false}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {s.status === "CHANGES_REQUESTED" ? "Sent back to the creator for changes." : s.status === "APPROVED" ? "Approved." : "Decided."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Flags, with this version's dismissals, for one post. */
function useFlags(s: ReviewQueueItem) {
  const flags = useMemo(() => flagsOf(s), [s]);
  const { forCurrent } = useFlagReviews(s.id, s.current_version);
  const dismissed = useMemo(() => new Set(forCurrent.keys()), [forCurrent]);
  return { flags, dismissed, reviews: forCurrent };
}

/** The selected post: media in the middle, the review panel on the right. Remounted per post. */
function Workspace({
  s,
  labels,
  canReview,
  onUploadScript,
}: {
  s: ReviewQueueItem;
  labels: { brand: (c?: string | null) => string | null; brands: (codes: string[]) => string | null; audience: (codes: string[]) => string | null };
  canReview: boolean;
  onUploadScript?: () => void;
}) {
  const { flags, dismissed, reviews } = useFlags(s);
  // Which panel tab is open, and which flag was picked on the post. Clicking the post drives both.
  // Every reviewer (deciding or suggesting) opens a post in review on the comments, to leave their suggestions.
  const { isSuggester } = useAuth();
  const startTab: PanelTab = s.status === "IN_REVIEW" && (canReview || isSuggester) ? "comments" : "compliance";
  const [tab, setTab] = useState<PanelTab>(startTab);
  const [seen, setSeen] = useState<Set<PanelTab>>(() => new Set<PanelTab>([startTab]));
  useEffect(() => {
    setSeen((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);
  const [picked, setPicked] = useState<string | null>(null);
  // The comment picked on the image or in the list, so each shows the other.
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = t;
      v.pause();
    }
    setNow(t);
  };
  return (
    <>
      <section aria-label="Post" className="min-w-0 flex-1 overflow-y-auto">
        <PostView
          s={s}
          flags={flags}
          dismissed={dismissed}
          labels={labels}
          videoRef={videoRef}
          now={now}
          duration={duration || Math.max(0, ...(s.latest_check?.segment_flags ?? []).map((f) => f.end_sec))}
          playing={playing}
          picked={picked}
          onFlag={(ruleId) => {
            setPicked(ruleId);
            setTab("compliance");
          }}
          onComment={() => setTab("comments")}
          onTime={setNow}
          onDuration={setDuration}
          onPlaying={setPlaying}
          seek={seek}
          onUploadScript={onUploadScript}
          canComment={(canReview || isSuggester) && s.status === "IN_REVIEW"}
          activeCommentId={activeComment}
          onActiveComment={(id) => {
            setActiveComment(id);
            if (id) setTab("comments");
          }}
        />
      </section>
      <ResizablePanel
        as="aside"
        label="Your review"
        storageKey="review"
        edge="left"
        min={320}
        max={900}
        className="flex min-h-[480px] shrink-0 flex-col border-t border-border/70 lg:min-h-0 lg:border-l lg:border-t-0"
        defaultWidth="lg:w-[400px] 2xl:w-[440px] min-[112.5rem]:w-[500px]"
      >
        <ReviewPanel
          s={s}
          flags={flags}
          dismissed={dismissed}
          reviews={reviews}
          canReview={canReview}
          now={now}
          hasVideo={Boolean(s.video)}
          seek={seek}
          tab={tab}
          setTab={setTab}
          seen={seen}
          picked={picked}
          setPicked={setPicked}
          activeComment={activeComment}
          setActiveComment={setActiveComment}
        />
      </ResizablePanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** The queue collapsed to a slim strip of thumbnails, each with a dot for how its check went. */
function QueueStrip({
  items,
  selectedId,
  count,
  onPick,
  onExpand,
  titleOf,
}: {
  items: ReviewQueueItem[];
  selectedId?: string;
  count: number;
  onPick: (id: string) => void;
  onExpand: () => void;
  titleOf: (s: ReviewQueueItem) => string;
}) {
  return (
    <nav aria-label="Review queue (collapsed)" className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border/70 py-3 lg:flex">
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExpand} aria-label="Expand the queue" title="Expand the queue">
        <PanelLeftOpen className="w-4 h-4" />
      </Button>
      <span className="text-[11px] font-medium tabular-nums text-muted-foreground" title={`${count} items`}>
        {count}
      </span>
      <ul className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1.5 pb-1 pt-1.5">
        {items.map((s) => {
          const failing = hasCritical(s) || isFailing(s);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                aria-current={selectedId === s.id}
                aria-label={`${s.title} (${s.reference_code})`}
                title={titleOf(s)}
                className={`relative block rounded-lg p-0.5 ${selectedId === s.id ? "ring-2 ring-blue-600" : "hover:ring-2 hover:ring-border"}`}
              >
                <Thumb s={s} />
                <span
                  className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-card ${
                    scoreOf(s) == null ? "bg-muted-foreground/50" : failing ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function ContentScreenerPage() {
  const { creatorView, hasPermission } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_VIEW") && !creatorView;
  const scope = isReviewer ? "all" : "mine";
  const [params, setParams] = useSearchParams();
  const { activeVideoId } = useVideoUploadQueue();

  const navigate = useNavigate();
  // Scripts are reviewed in Script review; an older link to one here (e.g. a notification) goes there.
  const legacyScript = params.get("script");
  useEffect(() => {
    if (legacyScript) navigate(`/script-review/scripts/${legacyScript}`, { replace: true });
  }, [legacyScript, navigate]);
  const [tab, setTab] = useState<QueueTab>("review");
  const postTab: QueueTab = tab;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortOrder>("newest");
  // Opened from elsewhere: ?id=..., or the post another page picked for the screener.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => params.get("id") ?? (activeVideoId?.startsWith("sub-") ? activeVideoId.slice(4) : null)
  );

  const queue = useQuery({
    queryKey: ["review-queue", postTab, scope],
    queryFn: () => submissionService.reviewQueue(postTab, undefined, scope),
    staleTime: 0,
    // Poll while a post is still being analysed so its score shows up soon after it's ready.
    refetchInterval: (q) => (q.state.data?.some((s) => isAnalysing(s.latest_check)) ? ANALYSING_REFETCH_MS : false),
  });
  const counts = useQuery({
    queryKey: ["review-queue", "counts", scope],
    queryFn: () => submissionService.reviewQueueCounts(scope),
    staleTime: 0,
  });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  const labels = useMemo(
    () => ({
      brand: (code?: string | null) => (code ? options.data?.brands.find((b) => b.code === code)?.name ?? code : null),
      brands: (codes: string[]) => (codes.length ? codes.map((c) => options.data?.brands.find((b) => b.code === c)?.name ?? c).join(", ") : null),
      audience: (codes: string[]) => audienceNames(codes, options.data?.audiences),
    }),
    [options.data]
  );

  const items = useMemo(() => queue.data ?? [], [queue.data]);
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => items.filter((s) => matches(s, filters, q)), [items, filters, q]);
  // Posts by when each was sent for review, newest or oldest first; posts without a date go last.
  const rows = useMemo(() => {
    const time = (d?: string | null) => (d ? new Date(d).getTime() : null);
    const sign = sort === "newest" ? -1 : 1;
    return visible
      .map((s) => ({ s, at: time(s.submitted_at) }))
      .sort((x, y) => Number(x.at === null) - Number(y.at === null) || (x.at === null || y.at === null ? 0 : sign * (x.at - y.at)))
      .map((r) => r.s);
  }, [visible, sort]);
  // 20 to a page; a new tab, search, filter or order starts from the first page.
  const paged = usePaged(rows, 20, [postTab, scope, q, filters, sort]);
  // A post opened from a link (?id=...) shows on its page once the queue has loaded.
  const shownLinked = useRef(false);
  useEffect(() => {
    if (shownLinked.current || !selectedId || rows.length === 0) return;
    shownLinked.current = true;
    paged.showItem((s) => s.id === selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedId]);
  // Whatever was picked last, else the first post on the page.
  const selected = visible.find((s) => s.id === selectedId) ?? paged.pageItems[0] ?? null;
  const listCount = visible.length;
  const renderPostRow = (s: ReviewQueueItem) => {
        const due = dueText(s, postTab);
        const current = selected?.id === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => pick(s.id)}
              aria-current={current}
              className={`flex w-full gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                current ? "border-border bg-muted" : "border-transparent hover:bg-muted/60"
              }`}
            >
              <Thumb s={s} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{s.title}</span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {s.content_type && CONTENT_TYPE_BADGES[s.content_type] && (
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${CONTENT_TYPE_BADGES[s.content_type].cls}`}>
                      {CONTENT_TYPE_BADGES[s.content_type].label}
                    </span>
                  )}
                  <span className="truncate">
                    {s.reference_code} · {s.platforms.map(platformName).join(", ") || "No platform"}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`truncate text-xs font-medium ${due.tone}`}>{due.text}</span>
                  <ScoreBadge s={s} />
                </span>
              </span>
            </button>
          </li>
        );
  };

  const brands = useMemo(() => [...new Set(items.flatMap((s) => brandCodes(s)).filter((b): b is string => Boolean(b)))].sort(), [items]);
  const platforms = useMemo(() => [...new Set(items.flatMap((s) => s.platforms))].sort(), [items]);
  // How many of the four filters are in use (brand and platform count once each, however many values they hold).
  const activeFilters = [filters.brands.length > 0, filters.platforms.length > 0, filters.due !== "any", filters.check !== "any"].filter(Boolean).length;

  // The queue can fold to a strip of thumbnails to give the post more room; remembered on this browser.
  const [queueCollapsed, setQueueCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const setCollapsed = (v: boolean) => {
    setQueueCollapsed(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      // just won't be remembered
    }
  };

  const pick = (id: string) => {
    setSelectedId(id);
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("id", id);
      return next;
    }, { replace: true });
  };

  return (
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:h-[calc(100dvh-10.5rem)] lg:flex-row">
      {/* ===== Queue, collapsed (wide screens): a slim strip of thumbnails ===== */}
      {queueCollapsed && (
        <QueueStrip
          items={visible}
          selectedId={selected?.id}
          count={listCount}
          onPick={pick}
          onExpand={() => setCollapsed(false)}
          titleOf={(s) => `${s.title} · ${dueText(s, postTab).text}`}
        />
      )}

      {/* ===== Queue ===== */}
      <ResizablePanel
        as="section"
        label="Review queue"
        storageKey="queue"
        edge="right"
        min={240}
        max={560}
        className={`flex max-h-[420px] shrink-0 flex-col border-b border-border/70 lg:max-h-none lg:border-b-0 lg:border-r ${queueCollapsed ? "lg:hidden" : ""}`}
        defaultWidth="lg:w-[300px] min-[112.5rem]:w-[360px]"
      >
        <div className="flex flex-col gap-2.5 border-b border-border/70 p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-semibold text-foreground">Content screener</h1>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-muted-foreground lg:inline-flex"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse the queue"
              title="Collapse the queue"
            >
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>

          <div role="tablist" aria-label="Queue" className="flex rounded-lg bg-muted p-0.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`h-7 flex-1 whitespace-nowrap rounded-md px-1 text-[11px] font-medium transition-colors ${
                  tab === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}{" "}
                <span className="text-muted-foreground">
                  {counts.data
                    ? counts.data[t.value] +
                      ((t.value === "review" ? counts.data.scripts : t.value === "sent_back" ? counts.data.scripts_sent_back : counts.data.scripts_done) ?? 0)
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts"
                aria-label="Search the queue"
                className="h-8 pl-8 text-[13px]"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-8 gap-1.5 px-2.5 text-xs" aria-label="Filters">
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
                  {activeFilters > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">{activeFilters}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 gap-3 p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="f-sort" className="text-xs font-medium text-muted-foreground">
                    Date sent
                  </Label>
                  <Select value={sort} onValueChange={(v) => setSort(v as SortOrder)}>
                    <SelectTrigger id="f-sort" size="sm" className="h-8 w-full text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["newest", "oldest"] as const).map((o) => (
                        <SelectItem key={o} value={o} className="text-[13px]">
                          {SORT_LABELS[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Brand</Label>
                  <MultiSelectFilter
                    options={brands.map((b) => ({ value: b, label: labels.brand(b) ?? b }))}
                    value={filters.brands}
                    onChange={(next) => setFilters((f) => ({ ...f, brands: next }))}
                    allLabel="All brands"
                    noun="brand"
                    ariaLabel="Brand"
                    className="h-8 w-full text-[13px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Platform</Label>
                  <MultiSelectFilter
                    options={platforms.map((p) => ({ value: p, label: platformName(p) }))}
                    value={filters.platforms}
                    onChange={(next) => setFilters((f) => ({ ...f, platforms: next }))}
                    allLabel="All platforms"
                    noun="platform"
                    ariaLabel="Platform"
                    className="h-8 w-full text-[13px]"
                  />
                </div>
                {[
                  {
                    id: "f-due",
                    label: tab === "sent_back" ? "Creator's deadline" : "Deadline",
                    value: filters.due,
                    set: (v: string) => setFilters((f) => ({ ...f, due: v as DueFilter })),
                    options: Object.entries(DUE_LABELS),
                  },
                  {
                    id: "f-check",
                    label: "Compliance check",
                    value: filters.check,
                    set: (v: string) => setFilters((f) => ({ ...f, check: v as CheckFilter })),
                    options: Object.entries(CHECK_LABELS),
                  },
                ].map((f) => (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={f.id} className="text-xs font-medium text-muted-foreground">
                      {f.label}
                    </Label>
                    <Select value={f.value} onValueChange={f.set}>
                      <SelectTrigger id={f.id} size="sm" className="h-8 w-full text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map(([value, text]) => (
                          <SelectItem key={value} value={value} className="text-[13px]">
                            {text}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-8 self-end text-xs" onClick={() => setFilters(NO_FILTERS)} disabled={!activeFilters}>
                  Clear filters
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          {activeFilters > 0 && (
            <div className="flex flex-wrap gap-1">
              {filters.brands.map((b) => (
                <FilterChip key={`brand-${b}`} text={labels.brand(b) ?? b} onClear={() => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) }))} />
              ))}
              {filters.platforms.map((p) => (
                <FilterChip key={`platform-${p}`} text={platformName(p)} onClear={() => setFilters((f) => ({ ...f, platforms: f.platforms.filter((x) => x !== p) }))} />
              ))}
              {filters.due !== "any" && <FilterChip text={DUE_LABELS[filters.due]} onClear={() => setFilters((f) => ({ ...f, due: "any" }))} />}
              {filters.check !== "any" && <FilterChip text={CHECK_LABELS[filters.check]} onClear={() => setFilters((f) => ({ ...f, check: "any" }))} />}
            </div>
          )}
        </div>
        <p className="px-4 pb-1 pt-2.5 text-xs text-muted-foreground">
          {queue.isLoading
            ? "Loading..."
            : `${listCount} item${listCount === 1 ? "" : "s"}${tab === "done" ? " · last 30 days" : ""} · sent ${
                sort === "newest" ? "newest" : "oldest"
              } first`}
        </p>
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {paged.pageItems.map(renderPostRow)}
          {queue.isLoading ? (
            <li className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading the queue...
            </li>
          ) : queue.isError ? (
            <li className="px-3 py-10 text-center text-xs text-red-600">Couldn't load the queue: {(queue.error as Error).message}</li>
          ) : visible.length === 0 ? (
            <li className="px-3 py-10 text-center text-xs text-muted-foreground">
              {items.length === 0 ? (tab === "review" ? "Nothing is waiting for review." : "Nothing here.") : "No posts match these filters."}
            </li>
          ) : (
            null
          )}
        </ul>
        <ListPager
          compact
          className="border-t border-border/70 px-4 py-2"
          page={paged.page}
          pageCount={paged.pageCount}
          pageSize={paged.pageSize}
          total={paged.total}
          noun="posts"
          onPage={paged.setPage}
        />
      </ResizablePanel>

      {/* ===== The post and the review panel ===== */}
      {selected ? (
        <Workspace
          key={`${selected.id}-${selected.current_version}`}
          s={selected}
          labels={labels}
          canReview={isReviewer && Boolean(selected.can_review)}
        />
      ) : (
        <div className="grid flex-1 place-items-center p-10 text-center">
          <div className="max-w-md space-y-3">
            <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500" />
            <p className="text-base font-semibold text-foreground">{queue.isLoading ? "Loading..." : "Nothing to show"}</p>
            <p className="text-xs text-muted-foreground">Pick a post from the queue to review it.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
      {text}
      <button type="button" onClick={onClear} aria-label={`Remove filter: ${text}`} className="text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
