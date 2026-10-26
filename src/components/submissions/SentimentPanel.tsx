import { useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  CheckCircle2,
  Copy,
  FlaskConical,
  Gauge,
  HelpCircle,
  History,
  Loader2,
  MessageSquareQuote,
  PlayCircle,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Volume2,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import TopicTrend from "@/components/submissions/TopicTrend";
import { trendSignals } from "@/components/submissions/topicTrendSignals";
import { usePublicMood } from "@/hooks/usePublicMood";
import type { PublicMood } from "@/types/publicMood";
import { isSentimentRunning, useSentiment } from "@/hooks/useSentiment";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type {
  FindingFeedback,
  FindingVerdict,
  SentimentAnalysis,
  SentimentAssessment,
  SentimentComparison,
  SentimentFinding,
  SentimentLevel,
  SentimentPrecedent,
  SentimentResult,
} from "@/types/sentiment";

const ASSESSMENT: Record<SentimentAssessment, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  NO_CONCERNS: {
    label: "No concerns",
    tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
    Icon: CheckCircle2,
  },
  REVIEW_SUGGESTED: {
    label: "Review suggested",
    tone: "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200",
    Icon: AlertTriangle,
  },
  SIGNIFICANT_CONCERNS: {
    label: "Significant concerns",
    tone: "border-red-500/40 bg-red-500/5 text-red-800 dark:text-red-200",
    Icon: XCircle,
  },
  INSUFFICIENT_INFORMATION: {
    label: "Not enough to assess",
    tone: "border-border bg-muted/40 text-foreground",
    Icon: HelpCircle,
  },
};

const LEVEL_TONE: Record<string, string> = {
  NONE: "text-emerald-700 dark:text-emerald-300",
  LOW: "text-emerald-700 dark:text-emerald-300",
  MODERATE: "text-amber-700 dark:text-amber-300",
  HIGH: "text-red-700 dark:text-red-300",
};
const SEVERITY_BADGE: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground border-border",
  MODERATE: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  HIGH: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};
const BRAND_LABELS: Record<string, string> = {
  ALIGNED: "Aligned",
  PARTIALLY_ALIGNED: "Partially aligned",
  MISALIGNED: "Misaligned",
  INSUFFICIENT_GUIDANCE: "No guidance yet",
};
const TARGET_LABELS: Record<string, string> = {
  PROBLEM: "Targets a problem",
  ECONOMICS: "Targets economics",
  SYSTEM_DESIGN: "Targets a design choice",
  PEOPLE_OR_INSTITUTIONS: "Targets people or institutions",
  MIXED: "Mixed targets",
};

const titleCase = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
const timestamp = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function Metric({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string | null; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/70 px-2.5 py-2 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold truncate ${tone}`} title={value}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground line-clamp-1 @2xl:line-clamp-3" title={sub}>
          {sub}
        </p>
      )}
    </div>
  );
}

/** The rulebook's 1-6 dial, with the 3-4 thought-leadership range marked. */
function ControversyDial({ level }: { level: number }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-1" role="img" aria-label={`Controversy level ${level} of 6`}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span
            key={n}
            className={`h-2 flex-1 rounded-full ${
              n > level
                ? "bg-muted"
                : n <= 2
                ? "bg-slate-400"
                : n <= 4
                ? "bg-blue-500"
                : "bg-red-500"
            } ${n === 3 || n === 4 ? "ring-1 ring-blue-500/30 ring-offset-1 ring-offset-background" : ""}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>Educational</span>
        <span className="text-blue-600 dark:text-blue-400 font-semibold">3-4 intended range</span>
        <span>Personal</span>
      </div>
    </div>
  );
}

const BASIS_LABELS: Record<SentimentFinding["basis"], string> = {
  OBSERVED_WORDING: "Observed wording",
  POSSIBLE_INTERPRETATION: "Possible interpretation",
  OBSERVED_VISUAL: "Observed in video",
  OBSERVED_AUDIO: "Heard in video",
};

/** What a finding needs to show its video frame and take a reviewer's vote. */
interface FindingContext {
  submissionId: string;
  analysis: SentimentAnalysis;
  /** Reviewers can rate findings; others only see the tallies. */
  canRate: boolean;
  onRate: (findingId: string, verdict?: FindingVerdict) => void;
  /** In the editor: swap the flagged wording for the suggested revision. False if the wording couldn't be found. */
  onApplyRevision?: (f: SentimentFinding) => boolean;
}

/** Whether a finding's suggested revision can replace its wording directly (the quote is one exact passage). */
export const canApplyRevision = (f: SentimentFinding) =>
  Boolean(f.suggested_revision && (f.source === "caption" || f.source === "title") && !/\.\.\.|…/.test(f.quote));

/** The analysed video's frame at the finding's moment, so a reviewer can confirm it at a glance. */
function FindingFrame({ ctx, at, onSeek }: { ctx: FindingContext; at: number; onSeek?: (sec: number) => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <button
      type="button"
      onClick={() => onSeek?.(at)}
      disabled={!onSeek}
      title={onSeek ? "Jump to this moment" : `Frame at ${timestamp(at)}`}
      className="relative block w-full max-w-[220px] overflow-hidden rounded-md border border-border/70 bg-black"
    >
      <img
        src={authedFileUrl(submissionService.sentimentFrameUrl(ctx.submissionId, ctx.analysis.id, at))}
        alt={`Video frame at ${timestamp(at)}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="block h-auto w-full"
      />
      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white tabular-nums">{timestamp(at)}</span>
    </button>
  );
}

/** The image a finding is about, so a reviewer can see exactly what was flagged. */
function FindingImage({ ctx, index }: { ctx: FindingContext; index: number }) {
  const [failed, setFailed] = useState(false);
  const name = ctx.analysis.images?.find((i) => i.index === index)?.name ?? `Image ${index}`;
  const label = (ctx.analysis.images?.length ?? 0) > 1 ? `Image ${index}` : "Image";
  if (failed) return <p className="text-[10px] text-muted-foreground">{label}: {name} (no longer available)</p>;
  return (
    <figure className="relative w-full max-w-[220px] overflow-hidden rounded-md border border-border/70 bg-muted">
      <img
        src={authedFileUrl(submissionService.sentimentImageUrl(ctx.submissionId, ctx.analysis.id, index))}
        alt={`${label}: ${name}`}
        title={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="block h-auto max-h-[220px] w-full object-contain"
      />
      <figcaption className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{label}</figcaption>
    </figure>
  );
}

function FeedbackButtons({ f, ctx }: { f: SentimentFinding; ctx: FindingContext }) {
  if (!f.id) return null;
  const fb: FindingFeedback = ctx.analysis.feedback?.[f.id] ?? { useful: 0, not_an_issue: 0 };
  if (!ctx.canRate && !fb.useful && !fb.not_an_issue) return null;
  const button = (verdict: FindingVerdict, Icon: typeof ThumbsUp, label: string, count: number) => {
    const mine = fb.mine === verdict;
    return (
      <button
        type="button"
        disabled={!ctx.canRate}
        aria-pressed={mine}
        onClick={() => ctx.onRate(f.id!, mine ? undefined : verdict)}
        title={ctx.canRate ? (mine ? "Take back your rating" : `Rate this finding: ${label.toLowerCase()}`) : undefined}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors disabled:cursor-default ${
          mine
            ? verdict === "USEFUL"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-slate-400/60 bg-muted text-foreground"
            : "border-border text-muted-foreground enabled:hover:text-foreground"
        }`}
      >
        <Icon className="w-3 h-3" /> {label}
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
      {ctx.canRate && <span className="text-[10px] text-muted-foreground">Was this right?</span>}
      {button("USEFUL", ThumbsUp, "Useful", fb.useful)}
      {button("NOT_AN_ISSUE", ThumbsDown, "Not an issue", fb.not_an_issue)}
    </div>
  );
}

function FindingCard({ f, onSeek, ctx }: { f: SentimentFinding; onSeek?: (sec: number) => void; ctx?: FindingContext }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const fromVideo = f.basis === "OBSERVED_VISUAL" || f.basis === "OBSERVED_AUDIO";
  const comparison = ctx?.analysis.comparison;
  const change = !f.id || !comparison ? null : comparison.new_ids.includes(f.id) ? "New" : comparison.still_ids.includes(f.id) ? "Still there" : null;
  const apply = () => {
    if (!ctx?.onApplyRevision) return;
    if (ctx.onApplyRevision(f)) {
      setApplied(true);
      toast.success(`Revision applied to the ${f.source}. Re-run the analysis to check it.`);
    } else {
      toast.error(`Couldn't find that wording in the ${f.source} any more. Copy the revision instead.`);
    }
  };
  return (
    <div className="rounded-lg border border-border/80 p-2.5 space-y-1.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground leading-snug">{f.title}</p>
        <span className="flex shrink-0 items-center gap-1">
          {change && (
            <span
              className={`rounded px-1.5 py-px text-[9px] font-bold uppercase ${
                change === "New" ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "bg-muted text-muted-foreground"
              }`}
              title={change === "New" ? "Not flagged last time" : "Also flagged last time"}
            >
              {change}
            </span>
          )}
          <span className={`rounded border px-1.5 py-px text-[9px] font-bold uppercase ${SEVERITY_BADGE[f.severity]}`}>{f.severity}</span>
        </span>
      </div>
      {ctx && f.image_index != null ? (
        <FindingImage ctx={ctx} index={f.image_index} />
      ) : (
        ctx?.analysis.has_video && f.start_sec != null && <FindingFrame ctx={ctx} at={f.start_sec} onSeek={onSeek} />
      )}
      <blockquote className={`border-l-2 border-primary/40 pl-2 text-foreground/90 ${fromVideo ? "" : "italic"}`}>
        {f.basis === "OBSERVED_VISUAL" && f.image_index != null ? (
          <>In the image: {f.quote}</>
        ) : f.basis === "OBSERVED_VISUAL" ? (
          <>Shown in the video: {f.quote}</>
        ) : f.basis === "OBSERVED_AUDIO" ? (
          <>Heard in the video: {f.quote}</>
        ) : (
          <>"{f.quote}"</>
        )}
        {f.start_sec != null && (
          <button
            type="button"
            onClick={() => onSeek?.(f.start_sec!)}
            disabled={!onSeek}
            className="ml-1.5 not-italic inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-semibold text-primary disabled:text-muted-foreground"
            title={onSeek ? "Jump to this moment" : "Transcript timestamp"}
          >
            <PlayCircle className="w-3 h-3" /> {timestamp(f.start_sec)}
          </button>
        )}
      </blockquote>
      <p className="text-muted-foreground leading-relaxed">{f.why_it_matters}</p>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-px">{titleCase(f.category)}</span>
        <span className="rounded bg-muted px-1.5 py-px">{BASIS_LABELS[f.basis] ?? f.basis}</span>
        {f.guideline_rule_number && (
          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-px text-primary">
            <BookOpen className="w-3 h-3" /> {f.guideline_rule_number}
          </span>
        )}
        {f.precedent && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-sky-500/10 px-1.5 py-px text-sky-700 dark:text-sky-300"
            title="A past review of similar content raised or cleared the same thing"
          >
            <History className="w-3 h-3" /> Like {f.precedent}
          </span>
        )}
        {f.source && f.source !== "transcript" && f.source !== "video" && <span>in {f.source}</span>}
      </div>
      {f.suggested_revision && (
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/25 p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Suggested revision</p>
          <p className="text-foreground">{f.suggested_revision}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {ctx?.onApplyRevision && canApplyRevision(f) && (
              <button
                type="button"
                onClick={apply}
                disabled={applied}
                title={`Replace "${f.quote}" with the suggested revision (Undo in the editor takes it back)`}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white enabled:hover:bg-emerald-700 disabled:opacity-70"
              >
                {applied ? <Check className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />} {applied ? "Applied" : `Apply to ${f.source}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(f.suggested_revision!).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  },
                  () => toast.error("Couldn't copy to the clipboard")
                );
              }}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy suggested revision"}
            </button>
          </div>
        </div>
      )}
      {ctx && <FeedbackButtons f={f} ctx={ctx} />}
    </div>
  );
}

/** How the video sounds: voiceover, music and effects, and whether that fits the message. */
function AudioCard({ audio }: { audio: NonNullable<SentimentResult["audio"]> }) {
  const parts = (
    [
      ["Voiceover", audio.voiceover],
      ["Music", audio.music],
      ["Sound effects", audio.sound_effects],
    ] as const
  ).filter(([, v]) => v);
  if (!parts.length && audio.fits_message == null && !audio.explanation) return null;
  return (
    <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Volume2 className="w-3.5 h-3.5" /> Audio
        </p>
        {audio.fits_message != null && (
          <span
            className={`rounded px-1.5 py-px text-[10px] font-semibold ${
              audio.fits_message ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {audio.fits_message ? "Fits the message" : "Doesn't fit the message"}
          </span>
        )}
      </div>
      {parts.length > 0 && (
        <dl className="grid grid-cols-1 @2xl:grid-cols-3 gap-x-3 gap-y-1">
          {parts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {audio.explanation && <p className="text-[11px] text-muted-foreground leading-relaxed">{audio.explanation}</p>}
    </div>
  );
}

// How serious an assessment is, to say whether a re-run got better or worse ("not enough to assess" has no direction).
const ASSESSMENT_RANK: Partial<Record<SentimentAssessment, number>> = { NO_CONCERNS: 0, REVIEW_SUGGESTED: 1, SIGNIFICANT_CONCERNS: 2 };
const LEVEL_RANK: Record<SentimentLevel, number> = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3 };

/** What changed since the previous analysis: the verdict, and which findings were fixed, are new or remain. */
function ComparisonView({ c, r }: { c: SentimentComparison; r: SentimentResult }) {
  const [showFixed, setShowFixed] = useState(false);
  const before = ASSESSMENT_RANK[c.previous_assessment];
  const after = ASSESSMENT_RANK[r.overall_assessment];
  const delta =
    before != null && after != null && before !== after
      ? after - before
      : LEVEL_RANK[r.reputational_concern] - LEVEL_RANK[c.previous_concern];
  const unchanged = c.previous_assessment === r.overall_assessment && c.previous_concern === r.reputational_concern;
  const Trend = delta < 0 ? TrendingDown : delta > 0 ? TrendingUp : ArrowRight;
  const trendTone = delta < 0 ? "text-emerald-700 dark:text-emerald-300" : delta > 0 ? "text-red-700 dark:text-red-300" : "text-muted-foreground";
  const against = c.same_version ? "the previous run" : `version ${c.previous_version}`;
  return (
    <div className="rounded-lg border border-border/70 p-2.5 space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <History className="w-3.5 h-3.5" /> Since {against}
          {c.previous_completed_at && (
            <span className="font-normal text-muted-foreground">({formatDistanceToNow(new Date(c.previous_completed_at), { addSuffix: true })})</span>
          )}
        </p>
        <p className={`flex items-center gap-1 text-[11px] font-semibold ${trendTone}`}>
          <Trend className="w-3.5 h-3.5" />
          {unchanged
            ? "Same verdict"
            : `${ASSESSMENT[c.previous_assessment].label}, ${titleCase(c.previous_concern).toLowerCase()} concern → ${ASSESSMENT[r.overall_assessment].label}, ${titleCase(r.reputational_concern).toLowerCase()} concern`}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <button
          type="button"
          disabled={!c.resolved.length}
          onClick={() => setShowFixed((v) => !v)}
          className="rounded bg-emerald-500/10 px-1.5 py-px font-semibold text-emerald-700 dark:text-emerald-300 enabled:hover:underline disabled:opacity-60"
        >
          {c.resolved.length} fixed
        </button>
        <span className="rounded bg-violet-500/10 px-1.5 py-px font-semibold text-violet-700 dark:text-violet-300">{c.new_ids.length} new</span>
        <span className="rounded bg-muted px-1.5 py-px font-semibold text-muted-foreground">{c.still_ids.length} still there</span>
      </div>
      {showFixed && c.resolved.length > 0 && (
        <ul className="space-y-1 border-t border-border/60 pt-1.5">
          {c.resolved.map((f, i) => (
            <li key={f.id ?? i} className="flex items-start gap-1.5 text-muted-foreground">
              <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600" />
              <span className="min-w-0">
                <span className="font-medium text-foreground">{f.title}</span> · <span className="line-through">{f.quote}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The past reviews of similar content the analysis was given, so a reviewer can see what precedent it followed. */
function PrecedentsView({ precedents }: { precedents: SentimentPrecedent[] }) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <History className="w-3.5 h-3.5" /> Similar past reviews
      </p>
      <ul className="grid grid-cols-1 @3xl:grid-cols-2 gap-2">
        {precedents.map((p) => {
          const approved = p.decision === "APPROVE";
          const name = (
            <>
              {p.label}
              {p.title && <span className="font-normal text-muted-foreground"> · {p.title}</span>}
            </>
          );
          return (
            <li key={p.label} className="rounded-lg border border-border/70 p-2 text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-semibold text-foreground">
                  {p.submission_id ? (
                    <Link to={`/submissions/${p.submission_id}`} className="hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <span
                  className={`shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase ${
                    approved ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {approved ? "Approved" : "Changes requested"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {p.same_post ? "Earlier version of this post" : `${Math.round(p.similarity * 100)}% similar`}
                {p.decided_at && ` · ${format(new Date(p.decided_at), "MMM d, yyyy")}`}
              </p>
              {p.notes && <p className="text-[11px] text-foreground/80 line-clamp-2">"{p.notes}"</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SEVERITY_RANK: Record<string, number> = { HIGH: 0, MODERATE: 1, LOW: 2 };
const TOP_FINDINGS = 3;

/** Most serious first; the first TOP_FINDINGS go in the summary, the rest under "More detail". */
const bySeverity = (findings: SentimentFinding[]) => [...findings].sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);

/**
 * The short answer: will it be perceived well? The verdict, what the topic numbers say, and the most serious
 * wording to fix (with the suggested fix one click away).
 */
function PerceptionSummary({ r, mood, ctx, onSeek }: { r: SentimentResult; mood?: PublicMood | null; ctx?: FindingContext; onSeek?: (sec: number) => void }) {
  const a = ASSESSMENT[r.overall_assessment];
  const signals = trendSignals(mood);
  const top = bySeverity(r.findings).slice(0, TOP_FINDINGS);
  return (
    <div className="space-y-2">
      <div className={`rounded-lg border p-2.5 ${a.tone}`}>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <a.Icon className="w-4 h-4" /> {a.label}
        </p>
        <p className="text-xs mt-1 leading-relaxed opacity-90">{r.summary}</p>
      </div>
      {signals.length > 0 && (
        <ul className="space-y-1">
          {signals.map((sig) => (
            <li
              key={sig.text}
              className={`flex items-start gap-1.5 text-[11px] ${sig.tone === "risk" ? "text-amber-800 dark:text-amber-200" : "text-emerald-800 dark:text-emerald-200"}`}
            >
              {sig.tone === "risk" ? <TrendingDown className="w-3 h-3 mt-px shrink-0" /> : <TrendingUp className="w-3 h-3 mt-px shrink-0" />}
              <span>
                {sig.text}
                {mood?.is_mock && <span className="text-muted-foreground"> (sample data)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {top.length > 0 && (
        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-2">
          {top.map((f, i) => (
            <FindingCard key={f.id ?? i} f={f} onSeek={onSeek} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultView({ r, onSeek, ctx }: { r: SentimentResult; onSeek?: (sec: number) => void; ctx?: FindingContext }) {
  // The most serious findings are already in the summary above.
  const more = bySeverity(r.findings).slice(TOP_FINDINGS);
  const c = r.controversy;
  const comparison = ctx?.analysis.comparison;
  return (
    <div className="space-y-3">

      {comparison && <ComparisonView c={comparison} r={r} />}

      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2">
        <Metric label="Primary tone" value={r.tone.primary} sub={[r.tone.secondary, `${titleCase(r.tone.intensity)} intensity`].filter(Boolean).join(" · ")} />
        <Metric label="Reputational concern" value={titleCase(r.reputational_concern)} tone={LEVEL_TONE[r.reputational_concern]} />
        <Metric label="Brand voice" value={BRAND_LABELS[r.brand_alignment.rating]} sub={r.brand_alignment.explanation} />
        {c.applies && c.level ? (
          <Metric label="Controversy" value={`${c.level} / 6`} sub={c.style} tone={c.level >= 5 ? LEVEL_TONE.HIGH : ""} />
        ) : (
          <Metric label="Controversy" value="Not applicable" sub="No thought-leadership rule set" />
        )}
      </div>

      {r.audio && <AudioCard audio={r.audio} />}

      {c.applies && c.level ? (
        <div className="rounded-lg border border-border/70 p-2.5 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Gauge className="w-3.5 h-3.5" /> Controversy dial
          </p>
          <ControversyDial level={c.level} />
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {c.target && (
              <span className={`rounded px-1.5 py-px ${c.target === "PEOPLE_OR_INSTITUTIONS" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>
                {TARGET_LABELS[c.target]}
              </span>
            )}
            {c.professional_and_nonpartisan != null && (
              <span className={`rounded px-1.5 py-px ${c.professional_and_nonpartisan ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                {c.professional_and_nonpartisan ? "Professional & nonpartisan" : "Not professional / nonpartisan"}
              </span>
            )}
            {c.capability_claims_precise != null && (
              <span className={`rounded px-1.5 py-px ${c.capability_claims_precise ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                {c.capability_claims_precise ? "Capability claims precise" : "Capability claims overstated"}
              </span>
            )}
            {c.defense_buyer_credibility_risk && (
              <span className="rounded bg-muted px-1.5 py-px text-muted-foreground">
                Defense-buyer credibility risk: <strong className={LEVEL_TONE[c.defense_buyer_credibility_risk]}>{titleCase(c.defense_buyer_credibility_risk)}</strong>
              </span>
            )}
          </div>
          {c.explanation && <p className="text-[11px] text-muted-foreground leading-relaxed">{c.explanation}</p>}
        </div>
      ) : null}

      {r.precedents && r.precedents.length > 0 && <PrecedentsView precedents={r.precedents} />}

      {more.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MessageSquareQuote className="w-3.5 h-3.5" /> More flagged language ({more.length})
          </p>
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-2">
            {more.map((f, i) => (
              <FindingCard key={f.id ?? i} f={f} onSeek={onSeek} ctx={ctx} />
            ))}
          </div>
        </div>
      )}

      {/* Audiences and gaps sit side by side when there's room. */}
      <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-3 items-start">
      {r.audience_interpretations.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Users className="w-3.5 h-3.5" /> How audiences may read it
          </p>
          {r.audience_interpretations.map((ai, i) => (
            <div key={i} className="text-xs border-l-2 border-border pl-2">
              <p className="font-medium text-foreground">
                {ai.audience} <span className={`text-[10px] font-semibold ${LEVEL_TONE[ai.concern_level as SentimentLevel]}`}>· {titleCase(ai.concern_level)} concern</span>
              </p>
              <p className="text-muted-foreground">{ai.likely_reading}</p>
            </div>
          ))}
        </div>
      )}

      {r.information_gaps.length > 0 && (
        <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground">Couldn't fully assess</p>
          {r.information_gaps.map((g, i) => (
            <p key={i}>· {g}</p>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/**
 * Gemini's editorial read of a submission: tone, brand voice, controversy and flagged wording.
 * Advisory only, shown alongside (never instead of) the rulebook check and human review.
 */
export default function SentimentPanel({
  submissionId,
  version,
  canRun: canRunProp = true,
  onSeek,
  onApplyRevision,
  beforeAnalyse,
  className = "",
}: {
  submissionId?: string | null;
  /** Show the analysis of this earlier version, as it was (it can't be re-run). */
  version?: number;
  canRun?: boolean;
  /** Jump the video player to a transcript timestamp. */
  onSeek?: (sec: number) => void;
  /** In the editor: put a finding's suggested revision in place of its wording; false if the wording isn't there. */
  onApplyRevision?: (f: SentimentFinding) => boolean;
  /** In the editor: saves the draft and runs the rulebook check, so one click runs every check. Resolves false if it
   * couldn't run, and then nothing else does. */
  beforeAnalyse?: () => Promise<boolean>;
  className?: string;
}) {
  const { analysis, isLoading, run, scheduleAfterReset, rate, saveTestCase, usage } = useSentiment(submissionId, version);
  const { hasPermission } = useAuth();
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  const [testCaseOpen, setTestCaseOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const canRun = canRunProp && version == null;
  // The topics' current mood only means something for the current content, not an earlier version.
  const topics = usePublicMood(submissionId, version == null);
  const running = isSentimentRunning(analysis) || run.isPending || preparing;
  /** All checks at once: the rulebook check (in the editor), the topics' trend, and the perception analysis. */
  const analyseAll = async () => {
    if (beforeAnalyse) {
      setPreparing(true);
      try {
        if (!(await beforeAnalyse())) return;
      } finally {
        setPreparing(false);
      }
    }
    topics.refresh();
    run.mutate();
  };
  const ctx: FindingContext | undefined =
    analysis && submissionId
      ? {
          submissionId,
          analysis,
          canRate: isReviewer,
          onRate: (findingId, verdict) => rate.mutate({ analysisId: analysis.id, findingId, verdict }),
          onApplyRevision: version == null ? onApplyRevision : undefined,
        }
      : undefined;
  const outOfRuns = usage?.remaining === 0;
  const companyCapped = Boolean(usage?.company_limit && usage.company_used >= usage.company_limit);
  const resetAt = companyCapped ? usage?.company_resets_at : usage?.resets_at;
  const resetsIn = resetAt ? formatDistanceToNow(new Date(resetAt)) : null;
  const result = analysis?.status === "COMPLETED" ? analysis.result : null;

  return (
    // A size container, so the result spreads into more columns wherever the panel is wide.
    <div className={`@container space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Sentiment analysis
          </p>
          <p className="text-[10px] text-muted-foreground">
            Advisory · how its topics are doing online, and how the post is likely to be perceived
            {beforeAnalyse ? ". Analyse also runs the rulebook check." : ""}
          </p>
        </div>
        {canRun && submissionId && (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              disabled={running || outOfRuns}
              onClick={analyseAll}
              title={
                outOfRuns
                  ? "Daily AI limit reached"
                  : beforeAnalyse
                  ? "Runs the rulebook check, the topic trend and the perception check together"
                  : undefined
              }
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {analysis ? "Re-run" : "Analyse"}
            </Button>
            {usage?.remaining != null && (
              <span className={`text-[10px] tabular-nums ${outOfRuns ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-muted-foreground"}`}>
                {outOfRuns ? "Daily limit reached" : `${usage.remaining} left today`}
              </span>
            )}
          </div>
        )}
      </div>
      {canRun && outOfRuns && (
        <p className="text-[11px] rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 px-2 py-1.5">
          The daily AI limit for sentiment analysis has been reached
          {companyCapped ? " for the whole company" : ""}.
          {resetsIn ? ` More runs free up in ${resetsIn}.` : ""} Unchanged content still shows its last result.
        </p>
      )}

      {submissionId && version == null && (
        <TopicTrend
          mood={topics.mood}
          isLoading={topics.isLoading}
          canEdit={canRunProp}
          busy={topics.dismissTopic.isPending}
          onDismiss={(topicId) => topics.dismissTopic.mutate({ topicId })}
          onRestore={(topicId) => topics.dismissTopic.mutate({ topicId, restore: true })}
        />
      )}

      {submissionId && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground border-t border-border/60 pt-3">
          <Users className="w-3.5 h-3.5 text-violet-500" /> How it'll be perceived
        </p>
      )}

      {!submissionId ? (
        <p className="text-xs text-muted-foreground">Save the draft to analyse its tone.</p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
        </p>
      ) : !analysis ? (
        <p className="text-xs text-muted-foreground">
          Not analysed yet.{canRun ? " Run it to check the tone, brand fit and how audiences may read it, including what the video shows." : ""}
        </p>
      ) : running ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border p-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          {analysis.status === "WAITING_TRANSCRIPT"
            ? "Waiting for the video transcript, then the tone analysis starts."
            : "Analysing tone, brand fit and controversy with Gemini..."}
        </p>
      ) : analysis.status === "SCHEDULED" ? (
        <p className="text-xs text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed border-border p-3">
          <CalendarClock className="w-3.5 h-3.5 shrink-0 mt-px text-violet-500" />
          <span>
            Gemini's daily limit was reached, so this runs automatically
            {analysis.retry_at ? ` after ${format(new Date(analysis.retry_at), "MMM d, h:mm a")}` : " once it resets"}. Nothing else to do.
          </span>
        </p>
      ) : analysis.status === "FAILED" && analysis.retry_at ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-800 dark:text-amber-200 space-y-2">
          <p>
            Gemini's daily limit for {analysis.model || "this model"} was reached, so this couldn't run. It resets{" "}
            {format(new Date(analysis.retry_at), "MMM d 'at' h:mm a")} ({formatDistanceToNow(new Date(analysis.retry_at), { addSuffix: true })}).
          </p>
          {canRun && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              disabled={scheduleAfterReset.isPending}
              onClick={() => scheduleAfterReset.mutate(analysis.id)}
            >
              {scheduleAfterReset.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarClock className="w-3 h-3" />}
              Run when it resets
            </Button>
          )}
        </div>
      ) : analysis.status === "FAILED" ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-700 dark:text-red-300">
          Sentiment analysis failed: {analysis.error || "unknown error"}
        </div>
      ) : result ? (
        <>
          {!analysis.is_current && (
            <p className="text-[11px] rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 px-2 py-1.5">
              The content, its rule sets, the rulebook or the messaging context changed since this analysis.{canRun ? " Re-run to update it." : ""}
            </p>
          )}
          {analysis.high_stakes && (
            <p className="flex items-center gap-1.5 text-[11px] rounded-md bg-violet-500/10 text-violet-800 dark:text-violet-200 px-2 py-1.5">
              <Zap className="w-3 h-3 shrink-0" />
              High-stakes post (CEO or investor-facing), so it was analysed with the stronger model.
            </p>
          )}
          <PerceptionSummary r={result} mood={version == null ? topics.mood : null} ctx={ctx} onSeek={onSeek} />
          <button
            type="button"
            onClick={() => setShowDetail((o) => !o)}
            aria-expanded={showDetail}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetail ? "rotate-180" : ""}`} />
            {showDetail ? "Less detail" : "More detail"}
            <span className="font-normal">(tone, brand voice, audiences, controversy{result.findings.length > TOP_FINDINGS ? ", more flagged wording" : ""})</span>
          </button>
          {showDetail && (
            <>
              <ResultView r={result} onSeek={onSeek} ctx={ctx} />
              {analysis.context_used && analysis.context_used.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Context used:</span> {analysis.context_used.join(", ")}
                </p>
              )}
            </>
          )}
          <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
            Editorial assessment, not legal clearance; it doesn't replace the rulebook check or reviewer approval.{" "}
            {analysis.model} · {analysis.prompt_version}
            {analysis.images && analysis.images.length > 0 &&
              ` · looked at ${analysis.images.length} image${analysis.images.length === 1 ? "" : "s"}`}
            {analysis.completed_at && ` · ${formatDistanceToNow(new Date(analysis.completed_at), { addSuffix: true })}`}
            {result.guidelines_used.length > 0 && ` · checked against ${result.guidelines_used.length} rule${result.guidelines_used.length === 1 ? "" : "s"}`}
            {result.unverified_findings_removed > 0 &&
              ` · ${result.unverified_findings_removed} finding${result.unverified_findings_removed === 1 ? "" : "s"} dropped because the quote wasn't in the content`}
          </p>
          {result.model_note && (
            <p className="text-[10px] text-amber-700 dark:text-amber-300">{result.model_note}</p>
          )}
          {isReviewer && (
            <button
              type="button"
              onClick={() => setTestCaseOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <FlaskConical className="w-3 h-3" /> Save as test case
            </button>
          )}
          {isReviewer && (
            <SaveTestCaseDialog
              open={testCaseOpen}
              onOpenChange={setTestCaseOpen}
              analysis={analysis}
              result={result}
              saving={saveTestCase.isPending}
              onSave={(data) => saveTestCase.mutate({ analysis_id: analysis.id, ...data }, { onSuccess: () => setTestCaseOpen(false) })}
            />
          )}
        </>
      ) : null}

    </div>
  );
}

const ASSESSMENT_OPTIONS: SentimentAssessment[] = ["NO_CONCERNS", "REVIEW_SUGGESTED", "SIGNIFICANT_CONCERNS", "INSUFFICIENT_INFORMATION"];
const CONCERN_OPTIONS: SentimentLevel[] = ["NONE", "LOW", "MODERATE", "HIGH"];
const LEVEL_LABEL: Record<SentimentLevel, string> = { NONE: "None", LOW: "Low", MODERATE: "Moderate", HIGH: "High" };
const ANY_CONCERN = "ANY";

/**
 * Freeze this analysed post as a test case with the verdict the reviewer agrees is right. Findings rated
 * "useful" must still be flagged next time, and ones rated "not an issue" must not be.
 */
function SaveTestCaseDialog({
  open,
  onOpenChange,
  analysis,
  result,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: SentimentAnalysis;
  result: SentimentResult;
  saving: boolean;
  onSave: (data: { expected_assessment: SentimentAssessment; expected_concern: SentimentLevel | null; notes?: string }) => void;
}) {
  const [assessment, setAssessment] = useState<SentimentAssessment>(result.overall_assessment);
  const [concern, setConcern] = useState<string>(ANY_CONCERN);
  const [notes, setNotes] = useState("");
  const rated = Object.values(analysis.feedback ?? {}).filter((fb) => fb.useful || fb.not_an_issue).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as test case</DialogTitle>
          <DialogDescription>
            This post is kept exactly as analysed and re-checked whenever the prompt or model changes.
            {rated > 0
              ? ` The ${rated} rated finding${rated === 1 ? "" : "s"} are included: "useful" ones must still be flagged, "not an issue" ones must not.`
              : " Rate findings first to also check that specific wording is (or isn't) flagged."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>The right overall assessment</Label>
            <Select value={assessment} onValueChange={(v) => setAssessment(v as SentimentAssessment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ASSESSMENT[a].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>The right reputational concern (optional)</Label>
            <Select value={concern} onValueChange={setConcern}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_CONCERN}>Don't check</SelectItem>
                {CONCERN_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {LEVEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sentiment-test-notes">Notes (optional)</Label>
            <Textarea
              id="sentiment-test-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this is the right verdict, e.g. a fair contrarian take, not a confrontational one"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              onSave({
                expected_assessment: assessment,
                expected_concern: concern === ANY_CONCERN ? null : (concern as SentimentLevel),
                notes: notes.trim() || undefined,
              })
            }
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save test case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
