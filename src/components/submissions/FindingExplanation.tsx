import type { ComplianceViolation } from "@/services/complianceService";

/** Keep the saved evidence and reason visible, including when the finding has no trigger words. */
export function FindingExplanation({ v, className = "space-y-2 px-4 pb-4 pl-[58px] text-[13px] leading-relaxed text-foreground/85" }: { v: ComplianceViolation; className?: string }) {
  const evidence = v.passage?.trim() || v.evaluation?.matched_text?.trim() || v.flagged_terms.join(", ");
  const reasoning = v.evaluation?.reasoning?.trim() || v.explanation?.trim();
  const needsReview = v.status === "NEEDS_REVIEW";
  const heading = needsReview ? "Why this needs review" : v.status === "EVIDENCE_REQUIRED" ? "Why evidence is needed" : "Why this was flagged";
  const reviewNote = needsReview ? "This is a request for review, not a confirmed rule breach." : null;
  if (!evidence && !reasoning) return null;
  return (
    <div className={className}>
      <EvidenceConsidered text={evidence} />
      <Reasoning text={reasoning} heading={heading} />
      <ReviewNote text={reviewNote} />
    </div>
  );
}

function EvidenceConsidered({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="rounded-lg border border-border/70 bg-background/70 px-3 py-2"><strong>Evidence considered:</strong> {text}</p>;
}

function Reasoning({ text, heading }: { text?: string; heading: string }) {
  if (!text) return null;
  return <p><strong>{heading}:</strong> {text}</p>;
}

function ReviewNote({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-xs font-medium text-muted-foreground">{text}</p>;
}
