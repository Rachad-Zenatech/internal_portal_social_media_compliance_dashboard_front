import { AlertCircle, CheckCircle2, ChevronDown, Info } from "lucide-react";
import { readableSentiment, REVIEW_ASSESSMENTS, sentimentBrandFit, sentimentContext, sentimentWatchouts } from "@/lib/reviewerSentiment";
import type { SentimentResult } from "@/types/sentiment";

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1 px-3 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-[13px] font-semibold text-foreground">{value}</dd></div>;
}

export function SentimentTakeaway({ result }: { result: SentimentResult }) {
  const clear = result.overall_assessment === "NO_CONCERNS";
  const uncertain = result.overall_assessment === "INSUFFICIENT_INFORMATION";
  const Icon = clear ? CheckCircle2 : uncertain ? Info : AlertCircle;
  const iconClass = clear || uncertain ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300";
  const brandFit = sentimentBrandFit(result);
  const reputation = readableSentiment(result.reputational_concern);
  const watchouts = sentimentWatchouts(result);
  return (
    <section className="space-y-3" aria-label="Sentiment takeaway">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2"><Icon className={`size-4 shrink-0 ${iconClass}`} /><h3 className="text-sm font-semibold text-foreground">{REVIEW_ASSESSMENTS[result.overall_assessment]}</h3></div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{result.summary}</p>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/20">
        <OverviewMetric label="Tone" value={result.tone.primary} />
        <OverviewMetric label="Brand fit" value={brandFit} />
        <OverviewMetric label="Reputation risk" value={reputation} />
      </dl>
      {watchouts.length > 0 && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-500/30 dark:bg-amber-500/5">
        <h3 className="text-xs font-semibold text-foreground">Also worth checking</h3>
        {watchouts.map((item) => <p key={item.label} className="text-[13px] leading-relaxed text-muted-foreground"><strong className="font-medium text-foreground">{item.label}: </strong>{item.text}</p>)}
      </div>}
    </section>
  );
}

export function SentimentSupportingContext({ result }: { result: SentimentResult }) {
  const rows = sentimentContext(result);
  const audiences = result.audience_interpretations;
  const gaps = [...new Set([...result.information_gaps, ...(result.context_report?.gaps ?? [])])];
  return (
    <details className="group rounded-xl border border-border bg-card p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded text-[13px] font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">Audience and supporting context <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-4 space-y-4">
        {audiences.map((audience) => <section key={audience.audience}><h4 className="text-xs font-semibold text-foreground">{audience.audience}</h4><p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{audience.likely_reading}</p></section>)}
        {rows.map((row) => <section key={row.label}><h4 className="text-xs font-semibold text-foreground">{row.label}</h4><p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{row.text}</p></section>)}
        {gaps.length > 0 && <section><h4 className="text-xs font-semibold text-foreground">What the analysis could not confirm</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></section>}
        {!rows.length && !audiences.length && !gaps.length && <p className="text-[13px] text-muted-foreground">No additional context was included in this analysis.</p>}
      </div>
    </details>
  );
}
