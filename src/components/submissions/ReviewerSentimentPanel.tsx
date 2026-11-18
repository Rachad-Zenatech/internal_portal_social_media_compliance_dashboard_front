import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSentiment, isSentimentRunning } from "@/hooks/useSentiment";
import { useAuth } from "@/lib/AuthContext";
import ReviewerSentimentConcerns from "@/components/submissions/ReviewerSentimentConcerns";
import { SentimentSupportingContext, SentimentTakeaway } from "@/components/submissions/ReviewerSentimentOverview";
import type { SentimentFinding } from "@/types/sentiment";

function SentimentReviewState({ title, message, busy, onRun }: { title: string; message: string; busy?: boolean; onRun?: () => void }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4" role="status">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">{busy && <Loader2 className="size-4 motion-safe:animate-spin" />}{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{message}</p>
      {onRun && <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={onRun}><RefreshCw className="size-3.5" /> Run sentiment check</Button>}
    </section>
  );
}

/** A short reviewer overview of the same saved sentiment analysis the creator sees. */
export default function ReviewerSentimentPanel({ submissionId, version, canRun = true, onSeek, onApplyRevision }: {
  submissionId: string;
  version?: number;
  canRun?: boolean;
  onSeek?: (sec: number) => void;
  onApplyRevision?: (finding: SentimentFinding) => boolean;
  /** Accepted for existing callers; the quick overview does not load topic trend reports. */
  showTopicTrends?: boolean;
}) {
  const { analysis, isLoading, run, rate, usage } = useSentiment(submissionId, version);
  const { hasPermission } = useAuth();
  const canRate = hasPermission("CONTENT_REVIEW_APPROVE");
  const capped = usage?.remaining === 0 || Boolean(usage?.company_limit && usage.company_used >= usage.company_limit);
  const mayRun = canRun && version == null && !capped;
  const runAnalysis = () => run.mutate();
  const running = isSentimentRunning(analysis) || run.isPending;
  if (isLoading) return <SentimentReviewState title="Loading sentiment overview" message="Getting the saved analysis for this post." busy />;
  if (running) return <SentimentReviewState title="Sentiment check in progress" message="The overview will appear here when the analysis finishes." busy />;
  if (analysis?.status === "SCHEDULED") return <SentimentReviewState title="Sentiment check scheduled" message="The analysis will resume automatically when more runs become available." />;
  if (analysis?.status === "FAILED") return <SentimentReviewState title="Sentiment overview unavailable" message="The last analysis could not finish. Try again to get an overview." onRun={mayRun ? runAnalysis : undefined} />;
  const result = analysis?.status === "COMPLETED" ? analysis.result : null;
  if (!analysis || !result) return <SentimentReviewState title="No sentiment overview yet" message="No completed sentiment analysis is available for this post." onRun={mayRun ? runAnalysis : undefined} />;
  const onRate = canRate ? (id: string, verdict?: "USEFUL" | "NOT_AN_ISSUE") => rate.mutate({ analysisId: analysis.id, findingId: id, verdict }) : undefined;
  const refreshTitle = capped ? "The sentiment run limit has been reached" : "Run the sentiment analysis again";
  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">Sentiment overview</h2><p className="mt-1 text-xs text-muted-foreground">How this post may come across to its audience.</p></div>
        {canRun && version == null && <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground" onClick={runAnalysis} disabled={!mayRun} title={refreshTitle}><RefreshCw className="size-3.5" /> Check again</Button>}
      </header>
      {!analysis.is_current && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">The media has changed since this analysis. Check again for an updated overview.</p>}
      <SentimentTakeaway result={result} />
      <ReviewerSentimentConcerns findings={result.findings} feedback={analysis.feedback} onSeek={onSeek} onRate={onRate} onApplyRevision={version == null ? onApplyRevision : undefined} ratingPending={rate.isPending} />
      <SentimentSupportingContext result={result} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">Shared with the creator. Sentiment is advisory; use it alongside the compliance check and your own review.</p>
    </div>
  );
}
