import { findingCopy } from "@/lib/findingCopy";
import type { ComplianceViolation } from "@/services/complianceService";

/** Keep the saved evidence and reason visible, including when the finding has no trigger words. */
export function FindingExplanation({ v, className = "space-y-2 px-4 pb-4 pl-[58px] text-[13px] leading-relaxed text-foreground/85" }: { v: ComplianceViolation; className?: string }) {
  const { evidence, reasoning, heading, action, reviewNote } = findingCopy(v);
  if (!evidence && !reasoning) return null;
  return (
    <div className={className}>
      <EvidenceConsidered text={evidence} />
      <Reasoning text={reasoning} heading={heading} />
      <ReviewNote text={reviewNote} />
      <Reasoning text={action ?? undefined} heading="What to do" />
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
