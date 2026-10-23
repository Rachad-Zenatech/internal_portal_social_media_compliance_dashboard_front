import { AlertTriangle, Ban, CheckCircle2, CircleDashed, ListChecks, XCircle } from "lucide-react";

import { isSentimentRunning, useSentiment } from "@/hooks/useSentiment";
import type { StoredCheck } from "@/types/submission";
import type { SentimentAssessment } from "@/types/sentiment";

type Verdict = "BLOCKED" | "CHANGES" | "REVIEW" | "READY" | "PARTIAL";

const VERDICT: Record<Verdict, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  BLOCKED: { label: "Blocked", tone: "border-red-500/40 bg-red-500/5 text-red-800 dark:text-red-200", Icon: Ban },
  CHANGES: { label: "Likely needs changes", tone: "border-red-500/40 bg-red-500/5 text-red-800 dark:text-red-200", Icon: XCircle },
  REVIEW: { label: "Worth a closer look", tone: "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200", Icon: AlertTriangle },
  READY: { label: "Looks ready for review", tone: "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200", Icon: CheckCircle2 },
  PARTIAL: { label: "Not fully checked yet", tone: "border-border bg-muted/40 text-foreground", Icon: CircleDashed },
};

const SENTIMENT_LABEL: Record<SentimentAssessment, string> = {
  NO_CONCERNS: "No concerns",
  REVIEW_SUGGESTED: "Review suggested",
  SIGNIFICANT_CONCERNS: "Significant concerns",
  INSUFFICIENT_INFORMATION: "Not enough to assess",
};

interface Item {
  key: string;
  from: "Rulebook" | "Sentiment";
  serious: boolean;
  title: string;
  detail?: string;
}

/**
 * The rulebook check and the sentiment analysis read together: one verdict, and the few things most worth fixing
 * first. Advisory, like both of its inputs; a reviewer makes the call.
 */
export default function ReadinessSummary({
  check,
  submissionId,
  className = "",
}: {
  check?: StoredCheck | null;
  submissionId?: string | null;
  className?: string;
}) {
  const { analysis } = useSentiment(submissionId);
  const sentiment = analysis?.status === "COMPLETED" ? analysis.result : null;
  if (!check && !sentiment) return null;

  const assessment = sentiment?.overall_assessment;
  let verdict: Verdict;
  if (check?.blocked) verdict = "BLOCKED";
  else if (check?.traffic_light === "RED" || assessment === "SIGNIFICANT_CONCERNS") verdict = "CHANGES";
  else if (check?.traffic_light === "YELLOW" || assessment === "REVIEW_SUGGESTED") verdict = "REVIEW";
  else if (!check || !sentiment || assessment === "INSUFFICIENT_INFORMATION") verdict = "PARTIAL";
  else verdict = "READY";
  const v = VERDICT[verdict];

  // Most serious first: red rulebook flags and high findings, then the rest.
  const items: Item[] = [
    ...(check?.violations ?? []).map((x) => ({
      key: `rule-${x.rule_id}-${x.kind ?? ""}`,
      from: "Rulebook" as const,
      serious: x.traffic_light === "RED",
      title: `${x.rule_number} · ${x.kind === "MISSING_DISCLAIMER" ? "Missing disclaimer" : x.title}`,
      detail: x.flagged_terms.length ? x.flagged_terms.map((t) => `"${t}"`).join(", ") : undefined,
    })),
    ...(sentiment?.findings ?? [])
      .filter((f) => f.severity !== "LOW")
      .map((f, i) => ({
        key: `sentiment-${f.id ?? i}`,
        from: "Sentiment" as const,
        serious: f.severity === "HIGH",
        title: f.title,
        detail: f.quote,
      })),
  ].sort((a, b) => Number(b.serious) - Number(a.serious));
  const shown = items.slice(0, 4);

  const sentimentLine = sentiment
    ? `${SENTIMENT_LABEL[sentiment.overall_assessment]}${analysis && !analysis.is_current ? " (out of date)" : ""}`
    : isSentimentRunning(analysis)
    ? "Running..."
    : "Not run yet";

  return (
    <div className={`rounded-lg border p-2.5 space-y-2 text-xs ${v.tone} ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <v.Icon className="w-4 h-4" /> {v.label}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <dt className="opacity-80">Rulebook</dt>
        <dd className="font-medium">
          {check
            ? `${check.score}/100 · ${check.blocked ? "blocked" : check.is_compliant ? "no issues" : `${check.violations_count} issue${check.violations_count === 1 ? "" : "s"}`}`
            : "Not checked yet"}
        </dd>
        <dt className="opacity-80">Sentiment</dt>
        <dd className="font-medium">{sentimentLine}</dd>
      </dl>
      {shown.length > 0 && (
        <div className="space-y-1 border-t border-current/15 pt-2">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
            <ListChecks className="w-3 h-3" /> Look at first
          </p>
          <ul className="space-y-1">
            {shown.map((item) => (
              <li key={item.key} className="flex items-start gap-1.5 text-foreground">
                <span
                  className={`mt-0.5 shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase ${
                    item.serious ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {item.from}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{item.title}</span>
                  {item.detail && <span className="block truncate text-muted-foreground">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {items.length > shown.length && (
            <p className="text-[10px] opacity-80">and {items.length - shown.length} more in the full results</p>
          )}
        </div>
      )}
      <p className="text-[10px] opacity-75">Advisory: both checks inform the review, and a reviewer makes the final call.</p>
    </div>
  );
}
