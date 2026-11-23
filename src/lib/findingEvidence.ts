import type { ComplianceViolation } from "@/services/complianceService";

const normalized = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).join(" ");
const clean = (text: string) => text.replace(/^\s*Text in image\s+\d+\s*:\s*/i, "").trim();

/** Locate the judged passage; a repeated trigger elsewhere is not evidence of this finding. */
export function findingEvidence(finding: ComplianceViolation): string[] {
  if (finding.evaluation?.source === "ADJUSTED" && finding.evaluation.model_decision === "NO_VIOLATION") return [];
  const matched = clean(finding.evaluation?.matched_text ?? "");
  const passage = clean(finding.passage ?? "");
  const context = passage.length <= 400 ? passage : "";
  const contains = (text: string, term: string) => ` ${normalized(text)} `.includes(` ${normalized(term)} `);
  if (matched) return [context && contains(context, matched) ? context : matched];
  if (context && finding.flagged_terms.some((term) => normalized(term) && contains(context, term))) return [context];
  return finding.flagged_terms.filter((term) => normalized(term));
}
