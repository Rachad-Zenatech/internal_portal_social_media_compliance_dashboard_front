import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Gauge,
  HelpCircle,
  Loader2,
  MessageSquareQuote,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isSentimentRunning, useSentiment } from "@/hooks/useSentiment";
import type { SentimentAssessment, SentimentFinding, SentimentLevel, SentimentResult } from "@/types/sentiment";

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

function FindingCard({ f, onSeek }: { f: SentimentFinding; onSeek?: (sec: number) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border/80 p-2.5 space-y-1.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground leading-snug">{f.title}</p>
        <span className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-bold uppercase ${SEVERITY_BADGE[f.severity]}`}>{f.severity}</span>
      </div>
      <blockquote className={`border-l-2 border-primary/40 pl-2 text-foreground/90 ${f.basis === "OBSERVED_VISUAL" ? "" : "italic"}`}>
        {f.basis === "OBSERVED_VISUAL" ? <>Shown in the video: {f.quote}</> : <>"{f.quote}"</>}
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
        <span className="rounded bg-muted px-1.5 py-px">
          {f.basis === "OBSERVED_WORDING" ? "Observed wording" : f.basis === "OBSERVED_VISUAL" ? "Observed in video" : "Possible interpretation"}
        </span>
        {f.guideline_rule_number && (
          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-px text-primary">
            <BookOpen className="w-3 h-3" /> {f.guideline_rule_number}
          </span>
        )}
        {f.source && f.source !== "transcript" && f.source !== "video" && <span>in {f.source}</span>}
      </div>
      {f.suggested_revision && (
        <div className="rounded-md bg-emerald-500/5 border border-emerald-500/25 p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Suggested revision</p>
          <p className="text-foreground">{f.suggested_revision}</p>
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
      )}
    </div>
  );
}

function ResultView({ r, onSeek }: { r: SentimentResult; onSeek?: (sec: number) => void }) {
  const a = ASSESSMENT[r.overall_assessment];
  const c = r.controversy;
  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-2.5 ${a.tone}`}>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <a.Icon className="w-4 h-4" /> {a.label}
        </p>
        <p className="text-xs mt-1 leading-relaxed opacity-90">{r.summary}</p>
      </div>

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

      {r.findings.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MessageSquareQuote className="w-3.5 h-3.5" /> Flagged language ({r.findings.length})
          </p>
          <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-2">
            {r.findings.map((f, i) => (
              <FindingCard key={i} f={f} onSeek={onSeek} />
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
  className = "",
}: {
  submissionId?: string | null;
  /** Show the analysis of this earlier version, as it was (it can't be re-run). */
  version?: number;
  canRun?: boolean;
  /** Jump the video player to a transcript timestamp. */
  onSeek?: (sec: number) => void;
  className?: string;
}) {
  const { analysis, isLoading, run, usage } = useSentiment(submissionId, version);
  const canRun = canRunProp && version == null;
  const running = isSentimentRunning(analysis) || run.isPending;
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
            <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Content sentiment
          </p>
          <p className="text-[10px] text-muted-foreground">Advisory · how the wording may read, not a prediction of reaction</p>
        </div>
        {canRun && submissionId && (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              disabled={running || outOfRuns}
              onClick={() => run.mutate()}
              title={outOfRuns ? "Daily AI limit reached" : undefined}
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
      ) : analysis.status === "FAILED" ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-700 dark:text-red-300">
          Sentiment analysis failed: {analysis.error || "unknown error"}
        </div>
      ) : result ? (
        <>
          {!analysis.is_current && (
            <p className="text-[11px] rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 px-2 py-1.5">
              The content, its rule sets or the rulebook changed since this analysis.{canRun ? " Re-run to update it." : ""}
            </p>
          )}
          <ResultView r={result} onSeek={onSeek} />
          <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/60 pt-2">
            Editorial assessment, not legal clearance; it doesn't replace the rulebook check or reviewer approval.{" "}
            {analysis.model} · {analysis.prompt_version}
            {analysis.completed_at && ` · ${formatDistanceToNow(new Date(analysis.completed_at), { addSuffix: true })}`}
            {result.guidelines_used.length > 0 && ` · checked against ${result.guidelines_used.length} rule${result.guidelines_used.length === 1 ? "" : "s"}`}
            {result.unverified_findings_removed > 0 &&
              ` · ${result.unverified_findings_removed} finding${result.unverified_findings_removed === 1 ? "" : "s"} dropped because the quote wasn't in the content`}
          </p>
        </>
      ) : null}
    </div>
  );
}
