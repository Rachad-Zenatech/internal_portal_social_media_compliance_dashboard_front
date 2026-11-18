import { useState } from "react";
import { ChevronDown, Play, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prioritiseSentiment, readableSentiment } from "@/lib/reviewerSentiment";
import type { FindingFeedback, FindingVerdict, SentimentFinding } from "@/types/sentiment";

type ConcernProps = {
  finding: SentimentFinding;
  feedback?: FindingFeedback;
  onSeek?: (sec: number) => void;
  onRate?: (id: string, verdict?: FindingVerdict) => void;
  onApplyRevision?: (finding: SentimentFinding) => boolean;
  ratingPending?: boolean;
};

function SentimentConcern({ finding, feedback, onSeek, onRate, onApplyRevision, ratingPending }: ConcernProps) {
  const [applied, setApplied] = useState(false);
  const at = finding.start_sec;
  const time = at == null ? null : `${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, "0")}`;
  const canApply = Boolean(onApplyRevision && finding.suggested_revision && ["caption", "script", "title"].includes(finding.source ?? ""));
  const canRate = Boolean(onRate && finding.id);
  const severityClass = finding.severity === "HIGH" ? "text-red-700 dark:text-red-300" : "text-muted-foreground";
  const apply = () => {
    if (onApplyRevision?.(finding)) { setApplied(true); toast.success("Suggested wording applied."); }
    else toast.error("The original wording has changed. Copy the suggestion instead.");
  };
  const rateUseful = () => onRate?.(finding.id!, feedback?.mine === "USEFUL" ? undefined : "USEFUL");
  const rateNotIssue = () => onRate?.(finding.id!, feedback?.mine === "NOT_AN_ISSUE" ? undefined : "NOT_AN_ISSUE");
  return (
    <article className="space-y-2.5 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[13px] font-semibold text-foreground">{finding.title}</p>
        <span className={`text-xs font-medium ${severityClass}`}>{readableSentiment(finding.severity)} concern</span>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{finding.why_it_matters}</p>
      {time && <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={!onSeek} onClick={() => onSeek?.(at!)} aria-label={`Play video at ${time}`}><Play className="size-3" /> {time}</Button>}
      <details className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">Wording and suggestion <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-3 space-y-3">
          {finding.quote && <blockquote className="border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted-foreground">{finding.quote}</blockquote>}
          {finding.suggested_revision && <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs font-medium text-foreground">Suggested wording</p><p className="mt-1 text-[13px] leading-relaxed text-foreground">{finding.suggested_revision}</p></div>}
          {canApply && <Button variant="outline" size="sm" disabled={applied} onClick={apply}>{applied ? "Applied" : "Use suggested wording"}</Button>}
          {canRate && <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={ratingPending} aria-pressed={feedback?.mine === "USEFUL"} onClick={rateUseful}><ThumbsUp className="size-3.5" /> Helpful</Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={ratingPending} aria-pressed={feedback?.mine === "NOT_AN_ISSUE"} onClick={rateNotIssue}><X className="size-3.5" /> Not an issue</Button>
          </div>}
        </div>
      </details>
    </article>
  );
}

export default function ReviewerSentimentConcerns({ findings, feedback, ...actions }: {
  findings: SentimentFinding[];
  feedback?: Record<string, FindingFeedback>;
} & Omit<ConcernProps, "finding" | "feedback">) {
  const ordered = prioritiseSentiment(findings);
  const visible = ordered.filter((finding, index) => index < 3 || finding.severity === "HIGH");
  const remaining = ordered.slice(visible.length);
  const renderConcern = (finding: SentimentFinding, index: number) => <SentimentConcern key={finding.id ?? index} finding={finding} feedback={finding.id ? feedback?.[finding.id] : undefined} {...actions} />;
  if (!ordered.length) return <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-[13px] text-muted-foreground">No specific wording concerns were raised.</p>;
  return (
    <section className="space-y-3" aria-label="Sentiment concerns">
      <h3 className="text-sm font-semibold text-foreground">Points to review <span className="ml-1 text-xs font-normal text-muted-foreground">({ordered.length})</span></h3>
      {visible.map(renderConcern)}
      {remaining.length > 0 && <details className="group"><summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">Show {remaining.length} more point{remaining.length === 1 ? "" : "s"} <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary><div className="mt-3 space-y-3">{remaining.map(renderConcern)}</div></details>}
    </section>
  );
}
