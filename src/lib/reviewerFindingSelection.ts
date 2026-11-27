import { findingEvidence } from "@/lib/findingEvidence";
import type { ComplianceViolation } from "@/services/complianceService";
import type { MarkedCaptionTerm } from "@/types/captionReview";

/** Highlight only the clicked finding, including when several findings share a rule. */
export function reviewerFindingSelection<T extends { v: ComplianceViolation }>(flags: T[], picked: string | null, finding: ComplianceViolation | null | undefined, dismissed: Set<string>) {
  const evidence = finding ? findingEvidence(finding).join("\n") : null;
  const selectedFlags = flags.filter(flag => picked && flag.v.rule_id === picked &&
    (evidence === null || findingEvidence(flag.v).join("\n") === evidence));
  const terms: MarkedCaptionTerm[] = selectedFlags.flatMap(flag => findingEvidence(flag.v)
    .map(term => ({ term, ruleId: flag.v.rule_id, dismissed: dismissed.has(flag.v.rule_id) })));
  return { selectedFlags, terms };
}
