import { useMemo, useRef, useState, type RefObject } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, endOfWeek, format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Search,
  Send,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import ReviewCommentsPanel, { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useFlagReviews, useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { ComplianceViolation } from "@/services/complianceService";
import type { QueueTab, ReviewCommentCategory, ReviewQueueItem } from "@/types/submission";

// ---------------------------------------------------------------------------
// Queue: tabs, filters and the few facts each row needs
// ---------------------------------------------------------------------------

const TABS: { value: QueueTab; label: string }[] = [
  { value: "review", label: "To review" },
  { value: "sent_back", label: "Sent back" },
  { value: "done", label: "Done" },
];

type DueFilter = "any" | "overdue" | "today" | "week" | "none";
type CheckFilter = "any" | "failing" | "critical" | "passing";
interface Filters {
  brand: string;
  platform: string;
  due: DueFilter;
  check: CheckFilter;
}
const NO_FILTERS: Filters = { brand: "all", platform: "all", due: "any", check: "any" };
const COLLAPSE_KEY = "contentScreener.queueCollapsed";

const DUE_LABELS: Record<DueFilter, string> = {
  any: "Any deadline",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No deadline",
};
const CHECK_LABELS: Record<CheckFilter, string> = {
  any: "Any result",
  failing: "Failing (red or under 60)",
  critical: "Has a critical flag",
  passing: "Passing",
};

const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
const scoreOf = (s: ReviewQueueItem) => (s.latest_check?.analysis_pending ? null : s.latest_check?.score ?? null);
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
    (f.brand === "all" || s.brand_code === f.brand) &&
    (f.platform === "all" || s.platforms.includes(f.platform)) &&
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
  if (isPast(due)) return { text: `${who}overdue ${formatDistanceToNow(due)}`, tone: tab === "review" ? "text-red-600 dark:text-red-400" : muted };
  if (isToday(due)) return { text: `${who}due today, ${format(due, "h:mm a")}`, tone: tab === "review" ? "text-amber-700 dark:text-amber-400" : muted };
  return { text: `${who}due ${format(due, "EEE, MMM d")}`, tone: muted };
}

function ScoreBadge({ s }: { s: ReviewQueueItem }) {
  const score = scoreOf(s);
  if (score == null) return <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">Checking</span>;
  const tone =
    score >= 80 && !hasCritical(s)
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      : score >= 60 && !hasCritical(s)
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${tone}`}>{score}</span>;
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
function HighlightedCaption({ text, terms }: { text: string; terms: string[] }) {
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

/** Platforms whose videos are usually vertical: the frame's shape until the video's real shape is known. */
const VERTICAL_PLATFORMS = ["TIKTOK", "INSTAGRAM", "YOUTUBE_SHORTS"];

interface TimelinePart {
  start: number;
  end: number;
  risk: "RED" | "YELLOW" | "GREEN";
}

/** The video split into its checked parts, each coloured by what was found there. A part covering the whole video
 * (the title and caption check) is left out when there are finer parts. */
function timelineOf(s: ReviewQueueItem, duration: number): TimelinePart[] {
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
function FlaggedMoments({
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

const CATEGORY_NAMES: Record<string, string> = {
  NOTE: "General note",
  LEGAL: "Legal",
  EDITORIAL: "Editorial",
  COMPLIANCE: "Compliance",
  BRAND: "Brand",
};

/** Write a reviewer comment, pinned to a moment, a range of the video, or no time. */
function CommentComposer({ s, now, hasVideo }: { s: ReviewQueueItem; now: number; hasVideo: boolean }) {
  const { add } = useReviewComments(s.id);
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");
  const [mode, setMode] = useState<"POINT" | "RANGE" | "NONE">(hasVideo ? "POINT" : "NONE");
  const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: 5 });
  const [body, setBody] = useState("");

  const post = () => {
    if (!body.trim()) return;
    const at = (t: number) => Math.round(t * 10) / 10;
    const times =
      !hasVideo || mode === "NONE"
        ? { start_sec: null, end_sec: null }
        : mode === "POINT"
        ? { start_sec: at(now), end_sec: null }
        : { start_sec: at(range.start), end_sec: at(Math.max(range.end, range.start + 1)) };
    add.mutate({ body: body.trim(), category, ...times }, { onSuccess: () => setBody("") });
  };

  const seg = (on: boolean) =>
    `flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        post();
      }}
      className="flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={(v) => setCategory(v as ReviewCommentCategory)}>
          <SelectTrigger size="sm" className="h-8 w-[150px] text-xs font-semibold" aria-label="Comment type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasVideo && (
          <div className="flex flex-wrap items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 text-[11px] font-semibold">
            <button type="button" onClick={() => setMode("POINT")} className={seg(mode === "POINT")}>
              <Clock className="w-3 h-3" /> Point ({formatSec(now)})
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("RANGE");
                setRange({ start: Math.floor(now), end: Math.floor(now) + 5 });
              }}
              className={seg(mode === "RANGE")}
            >
              <Layers className="w-3 h-3" /> Range ({formatSec(range.start)} - {formatSec(range.end)})
            </button>
            <button type="button" onClick={() => setMode("NONE")} className={seg(mode === "NONE")}>
              No time
            </button>
          </div>
        )}
      </div>
      {hasVideo && mode === "RANGE" && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setRange((r) => ({ start: Math.floor(now), end: Math.max(r.end, Math.floor(now) + 1) }))}>
            Set start ({formatSec(now)})
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() =>
              setRange((r) => {
                // An end before the start moves the start back, so the range is never empty.
                const t = Math.ceil(now);
                return t > r.start ? { start: r.start, end: t } : { start: Math.max(0, t - 3), end: Math.max(t, 1) };
              })
            }>
            Set end ({formatSec(now)})
          </Button>
          <span className="text-muted-foreground">Play to the moment you want, then set the start or end.</span>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            !hasVideo || mode === "NONE"
              ? "Add a general reviewer note..."
              : mode === "POINT"
              ? `Add a reviewer note at ${formatSec(now)}... (e.g. adjust the disclaimer or cut)`
              : `Add a reviewer note for ${formatSec(range.start)} - ${formatSec(range.end)}... (e.g. cut this section)`
          }
          aria-label="Reviewer note"
          className="h-9 min-w-0 flex-1 text-sm"
        />
        <Button type="submit" className="h-9 shrink-0 gap-1.5 px-4 text-xs font-semibold" disabled={!body.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Post comment
        </Button>
      </div>
    </form>
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
  canComment,
  onTime,
  onDuration,
  onPlaying,
  seek,
}: {
  s: ReviewQueueItem;
  flags: Flag[];
  dismissed: Set<string>;
  labels: { brand: (c?: string | null) => string | null; audience: (c?: string | null) => string | null };
  videoRef: RefObject<HTMLVideoElement | null>;
  now: number;
  duration: number;
  playing: boolean;
  canComment: boolean;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
  onPlaying: (p: boolean) => void;
  seek: (t: number) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = s.images ?? [];
  const image = images[Math.min(imageIndex, images.length - 1)];
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
  const terms = flags.filter((f) => !dismissed.has(f.v.rule_id)).flatMap((f) => f.v.flagged_terms);
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
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link to={`/submissions/${s.id}`}>
              <ExternalLink className="w-3.5 h-3.5" /> Full details & history
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {s.platforms.map((p) => (
            <span key={p} className={`${chip} inline-flex items-center gap-1`}>
              <PlatformIcon platform={p as SocialPlatform} className="w-3 h-3" /> {platformName(p)}
              {p === s.platforms[0] && account?.handle ? ` · @${account.handle.replace(/^@/, "")}` : ""}
            </span>
          ))}
          {labels.brand(s.brand_code) && <span className={chip}>{labels.brand(s.brand_code)}</span>}
          {labels.audience(s.audience) && <span className={chip}>{labels.audience(s.audience)}</span>}
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

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-5">
        {s.video ? (
          <>
            {/* The frame matches the video's own shape: vertical reels stay vertical, landscape stays wide */}
            <div
              className={`relative mx-auto max-w-full overflow-hidden rounded-xl bg-black ${tall ? "h-[min(50vh,500px)]" : "w-full max-w-[640px]"}`}
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
            <div className="grid place-items-center overflow-hidden rounded-xl bg-muted">
              <img src={authedFileUrl(image.url)} alt={image.original_name} className="max-h-[56vh] w-auto object-contain" />
            </div>
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

        {/* The reviewer's comment box, under the post as before */}
        {canComment ? (
          <div className="border-t border-border/70 pt-4">
            <CommentComposer s={s} now={now} hasVideo={Boolean(s.video)} />
          </div>
        ) : s.status !== "IN_REVIEW" ? (
          <p className="border-t border-border/70 pt-4 text-xs text-muted-foreground">
            This was decided, so its notes are read-only. To raise something new, reopen it for changes.
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Caption</span>
            <span className="text-xs text-muted-foreground">{(s.caption_text ?? "").length.toLocaleString()} characters</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {s.caption_text ? <HighlightedCaption text={s.caption_text} terms={terms} /> : <span className="text-muted-foreground">No caption.</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review panel: score, flags / sentiment / comments / script, and the decision
// ---------------------------------------------------------------------------

type PanelTab = "flags" | "sentiment" | "comments" | "script";

function ReviewPanel({
  s,
  flags,
  dismissed,
  canReview,
  now,
  hasVideo,
  seek,
}: {
  s: ReviewQueueItem;
  flags: Flag[];
  dismissed: Set<string>;
  canReview: boolean;
  now: number;
  hasVideo: boolean;
  seek: (t: number) => void;
}) {
  const [tab, setTab] = useState<PanelTab>("flags");
  const { comments } = useReviewComments(s.id);
  const check = s.latest_check;
  const score = scoreOf(s);
  const open = flags.filter((f) => !dismissed.has(f.v.rule_id));
  const openCritical = open.filter((f) => f.critical).length;
  const manual = check?.manual_review_rules ?? [];
  const transcript = [...(s.video?.transcript ?? [])].sort((a, b) => a.start_sec - b.start_sec);

  const verdict =
    score == null
      ? { text: "Still checking", tone: "text-muted-foreground", ring: "border-muted" }
      : openCritical
      ? { text: "Needs changes", tone: "text-red-700 dark:text-red-400", ring: "border-red-300 dark:border-red-500/50" }
      : open.length
      ? { text: "Review suggested", tone: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-500/50" }
      : { text: "Ready to approve", tone: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-300 dark:border-emerald-500/50" };

  const tabs: { value: PanelTab; label: string; count?: number; alert?: boolean }[] = [
    { value: "flags", label: "Flags", count: open.length, alert: openCritical > 0 },
    { value: "sentiment", label: "Sentiment" },
    { value: "comments", label: "Comments", count: comments.length },
    ...(hasVideo ? [{ value: "script" as const, label: "Script", count: transcript.length }] : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Score */}
      <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
        <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] ${verdict.ring}`}>
          <span className="text-center leading-none">
            <span className="block text-xl font-bold tabular-nums text-foreground">{score ?? "–"}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </span>
        </div>
        <div className="min-w-0">
          <p className={`text-[15px] font-semibold ${verdict.tone}`}>{verdict.text}</p>
          <p className="text-sm text-muted-foreground">
            {open.length} open flag{open.length === 1 ? "" : "s"}
            {openCritical > 0 && ` · ${openCritical} critical`}
            {flags.length > open.length && ` · ${flags.length - open.length} dismissed`}
          </p>
          {check?.rules_checked != null && (
            <p className="text-xs text-muted-foreground">
              {check.rules_checked - manual.length} of {check.rules_checked} rules checked automatically
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Review sections" className="flex gap-1 border-b border-border/70 px-3 pt-2">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors ${
              tab === t.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`min-w-[18px] rounded-full px-1.5 text-[11px] font-semibold ${
                  t.alert ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-muted text-foreground/70"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {tab === "flags" &&
          (flags.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto w-7 h-7 text-emerald-500" />
              <p className="mt-2 text-sm font-semibold text-foreground">No rulebook flags</p>
              <p className="text-xs text-muted-foreground">{score == null ? "The check is still reading this post." : "Nothing in this post broke a rule."}</p>
            </div>
          ) : (
            <>
              {flags.map((f) => {
                const isDismissed = dismissed.has(f.v.rule_id);
                const selected = f.at != null && Math.abs(now - f.at) < 0.75;
                const jump = () => f.at != null && seek(f.at);
                return (
                  <article
                    key={f.v.rule_id}
                    // The whole card jumps the video to where it was found (as on the previous screener).
                    onClick={jump}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        jump();
                      }
                    }}
                    tabIndex={f.at != null ? 0 : undefined}
                    aria-label={f.at != null ? `${f.v.rule_number}: jump to ${formatSec(f.at)}` : undefined}
                    className={`flex flex-col gap-2 rounded-xl border p-3.5 transition-colors ${
                      f.at != null ? "cursor-pointer" : ""
                    } ${
                      selected
                        ? "ring-2 ring-blue-500/50"
                        : ""
                    } ${
                      f.critical
                        ? "border-red-500/30 bg-red-500/5 hover:border-red-500/60"
                        : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60"
                    } ${isDismissed ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          f.critical
                            ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                        }`}
                      >
                        {f.critical ? "Critical" : "Needs review"}
                      </span>
                      {f.at != null && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatSec(f.at)}
                          {f.end != null && f.end > f.at + 0.5 && ` - ${formatSec(f.end)}`}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{f.v.rule_number}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{f.where}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{f.v.title}</p>
                    {f.v.flagged_terms.length > 0 && (
                      <p className="rounded-lg bg-muted px-2.5 py-1.5 text-[13px] text-foreground">
                        {f.v.flagged_terms.map((t) => `“${t}”`).join(", ")}
                      </p>
                    )}
                    {f.v.kind === "MISSING_DISCLAIMER" && f.v.missing_disclaimers?.[0] && (
                      <p className="text-[13px] text-foreground/80">
                        <span className="font-semibold">Needs:</span> “{f.v.missing_disclaimers[0]}”
                      </p>
                    )}
                    {f.v.remediation_guidance && (
                      <p className="text-[13px] text-foreground/80">
                        <span className="font-semibold">Suggested fix:</span> {f.v.remediation_guidance}
                      </p>
                    )}
                    <FlagReviewControl
                      submissionId={s.id}
                      currentVersion={s.current_version}
                      ruleId={f.v.rule_id}
                      ruleNumber={f.v.rule_number}
                      canDismiss={canReview}
                    />
                  </article>
                );
              })}
            </>
          ))}
        {tab === "flags" && manual.length > 0 && (
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="text-sm font-semibold text-foreground">Check by hand</p>
            <p className="mb-2 text-xs text-muted-foreground">The text check can't test these. You confirm them when you approve.</p>
            <ul className="flex flex-col gap-1 text-[13px] text-foreground/80">
              {manual.map((r) => (
                <li key={r.rule_number}>
                  <span className="text-muted-foreground">{r.rule_number}</span> · {r.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "sentiment" && <SentimentPanel key={s.id} submissionId={s.id} canRun={canReview} onSeek={seek} />}

        {tab === "comments" && (
          <ReviewCommentsPanel
            submissionId={s.id}
            canComment={canReview}
            currentTime={hasVideo ? now : undefined}
            onSeek={seek}
            showHeader={false}
            showComposer={false}
            emptyText="No comments yet. Write one under the video; they go to the creator with your decision."
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
                due_at: s.due_at,
                due_kind: s.due_kind,
                can_review: s.can_review,
                can_approve: s.can_approve,
                approver_names: s.approver_names,
                open_critical_flags: s.open_critical_flags,
                score: s.latest_check?.score ?? null,
                manual_rules: manual,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for a reviewer's decision.</p>
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
  return { flags, dismissed };
}

/** The selected post: media in the middle, the review panel on the right. Remounted per post. */
function Workspace({
  s,
  labels,
  canReview,
}: {
  s: ReviewQueueItem;
  labels: { brand: (c?: string | null) => string | null; audience: (c?: string | null) => string | null };
  canReview: boolean;
}) {
  const { flags, dismissed } = useFlags(s);
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
          canComment={canReview && s.status === "IN_REVIEW"}
          onTime={setNow}
          onDuration={setDuration}
          onPlaying={setPlaying}
          seek={seek}
        />
      </section>
      <aside
        aria-label="Your review"
        className="flex min-h-[480px] shrink-0 flex-col border-t border-border/70 lg:min-h-0 lg:w-[400px] lg:border-l lg:border-t-0 2xl:w-[440px]"
      >
        <ReviewPanel s={s} flags={flags} dismissed={dismissed} canReview={canReview} now={now} hasVideo={Boolean(s.video)} seek={seek} />
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentScreenerPage() {
  const { creatorView, hasPermission } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE") && !creatorView;
  const scope = isReviewer ? "all" : "mine";
  const [params, setParams] = useSearchParams();
  const { activeVideoId } = useVideoUploadQueue();

  const [tab, setTab] = useState<QueueTab>("review");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // Opened from elsewhere: ?id=..., or the post another page picked for the screener.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => params.get("id") ?? (activeVideoId?.startsWith("sub-") ? activeVideoId.slice(4) : null)
  );

  const queue = useQuery({
    queryKey: ["review-queue", tab, scope],
    queryFn: () => submissionService.reviewQueue(tab, undefined, scope),
    staleTime: 0,
    refetchInterval: 60_000,
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
      audience: (code?: string | null) => (code ? options.data?.audiences[code] ?? code : null),
    }),
    [options.data]
  );

  const items = useMemo(() => queue.data ?? [], [queue.data]);
  const q = search.trim().toLowerCase();
  const visible = useMemo(() => items.filter((s) => matches(s, filters, q)), [items, filters, q]);
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null;

  const brands = useMemo(() => [...new Set(items.map((s) => s.brand_code).filter((b): b is string => Boolean(b)))].sort(), [items]);
  const platforms = useMemo(() => [...new Set(items.flatMap((s) => s.platforms))].sort(), [items]);
  const activeFilters = (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => filters[k] !== NO_FILTERS[k]).length;

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
        <nav aria-label="Review queue (collapsed)" className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border/70 py-3 lg:flex">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCollapsed(false)} aria-label="Expand the queue" title="Expand the queue">
            <PanelLeftOpen className="w-4 h-4" />
          </Button>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground" title={`${visible.length} posts`}>
            {visible.length}
          </span>
          <ul className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1 pb-1">
            {visible.map((s) => {
              const failing = hasCritical(s) || isFailing(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s.id)}
                    aria-current={selected?.id === s.id}
                    aria-label={`${s.title} (${s.reference_code})`}
                    title={`${s.title} · ${dueText(s, tab).text}`}
                    className={`relative block rounded-lg p-0.5 ${selected?.id === s.id ? "ring-2 ring-blue-600" : "hover:ring-2 hover:ring-border"}`}
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
      )}

      {/* ===== Queue ===== */}
      <section
        aria-label="Review queue"
        className={`flex max-h-[420px] shrink-0 flex-col border-b border-border/70 lg:max-h-none lg:w-[300px] lg:border-b-0 lg:border-r ${queueCollapsed ? "lg:hidden" : ""}`}
      >
        <div className="flex flex-col gap-3 border-b border-border/70 p-4">
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
                className={`h-7 flex-1 rounded-md text-xs font-medium transition-colors ${
                  tab === t.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label} <span className="text-muted-foreground">{counts.data?.[t.value] ?? ""}</span>
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
                {[
                  {
                    id: "f-brand",
                    label: "Brand",
                    value: filters.brand,
                    set: (v: string) => setFilters((f) => ({ ...f, brand: v })),
                    options: [["all", "All brands"], ...brands.map((b) => [b, labels.brand(b) ?? b])],
                  },
                  {
                    id: "f-platform",
                    label: "Platform",
                    value: filters.platform,
                    set: (v: string) => setFilters((f) => ({ ...f, platform: v })),
                    options: [["all", "All platforms"], ...platforms.map((p) => [p, platformName(p)])],
                  },
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
              {filters.brand !== "all" && <FilterChip text={labels.brand(filters.brand) ?? filters.brand} onClear={() => setFilters((f) => ({ ...f, brand: "all" }))} />}
              {filters.platform !== "all" && <FilterChip text={platformName(filters.platform)} onClear={() => setFilters((f) => ({ ...f, platform: "all" }))} />}
              {filters.due !== "any" && <FilterChip text={DUE_LABELS[filters.due]} onClear={() => setFilters((f) => ({ ...f, due: "any" }))} />}
              {filters.check !== "any" && <FilterChip text={CHECK_LABELS[filters.check]} onClear={() => setFilters((f) => ({ ...f, check: "any" }))} />}
            </div>
          )}
        </div>
        <p className="px-4 pb-1 pt-2.5 text-xs text-muted-foreground">
          {queue.isLoading ? "Loading..." : `${visible.length} post${visible.length === 1 ? "" : "s"}${tab === "done" ? " · last 30 days" : " · soonest deadline first"}`}
        </p>
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
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
            visible.map((s) => {
              const due = dueText(s, tab);
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
                      <span className="truncate text-xs text-muted-foreground">
                        {s.reference_code} · {s.platforms.map(platformName).join(", ") || "No platform"}
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-xs font-medium ${due.tone}`}>{due.text}</span>
                        <ScoreBadge s={s} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* ===== The post and the review panel ===== */}
      {selected ? (
        <Workspace key={`${selected.id}-${selected.current_version}`} s={selected} labels={labels} canReview={isReviewer && Boolean(selected.can_review)} />
      ) : (
        <div className="grid flex-1 place-items-center p-10 text-center">
          <div>
            <CheckCircle2 className="mx-auto w-9 h-9 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-foreground">{queue.isLoading ? "Loading..." : "Nothing to show"}</p>
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
