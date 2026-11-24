import { FindingExplanation } from "@/components/submissions/FindingExplanation";
import { ConfidenceBadge, statusOf } from "@/components/submissions/FindingStatus";
import type { ComplianceViolation } from "@/services/complianceService";

/** Reviewers and creators read the same saved evidence and explanation. */
export default function ReviewerFindingDetails({ finding }: { finding: ComplianceViolation }) {
  const status = statusOf(finding);
  const cleared = status === "CLEARED";
  const penalty = finding.penalty;
  const points = penalty == null ? null : penalty > 0 ? `−${penalty} points` : "No points deducted";
  const showPoints = !cleared && points != null;
  const guidance = !cleared ? finding.remediation_guidance?.trim() : null;
  const guidanceLabel = status === "NEEDS_REVIEW" ? "If this concern is confirmed:" : "What to do:";
  const disclaimers = !cleared && finding.kind === "MISSING_DISCLAIMER" ? finding.missing_disclaimers ?? [] : [];
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-foreground/85">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConfidenceBadge v={finding} />
        {showPoints && <span className="ml-auto font-semibold tabular-nums text-foreground">{points}</span>}
      </div>
      <FindingExplanation v={finding} className="space-y-2" />
      <RequiredDisclaimer options={disclaimers} />
      {guidance && <p><strong>{guidanceLabel}</strong> {guidance}</p>}
    </div>
  );
}

function RequiredDisclaimer({ options }: { options: string[] }) {
  if (!options.length) return null;
  const heading = options.length > 1 ? "Approved disclaimer options (use one):" : "Required disclaimer:";
  const choices = options.map((text) => <blockquote key={text} className="mt-1 whitespace-pre-wrap rounded-md bg-muted/70 px-2.5 py-2">{text}</blockquote>);
  return (
    <details className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
      <summary className="cursor-pointer font-semibold">{heading} <span className="font-normal text-muted-foreground">({options.length})</span></summary>
      <div className="mt-2 max-h-64 overflow-y-auto pr-1">{choices}</div>
    </details>
  );
}
