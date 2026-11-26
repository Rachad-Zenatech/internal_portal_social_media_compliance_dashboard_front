import type { ComplianceViolation } from "@/services/complianceService";
import { evidenceRequestExplanation } from "@/lib/complianceFinding";

/** Simplify saved boilerplate without changing the evidence, decision or confidence. */
export function readableFindingReason(text: string): string {
  return text.replace(/^Visual review of [^\n]+?:\s*/i, "")
    .replace(/An enlarged image section suggests prohibited wording, but the letters are uncertain\.\s*A reviewer should inspect this specific area\./gi,
      "Some text in this image may break this rule, but it is too small or blurry to read confidently. Check that area in the original image.")
    .trim();
}

/** Creators and reviewers get the same evidence, explanation and practical next step. */
export function findingCopy(v: ComplianceViolation) {
  const status = v.status ?? "VIOLATION";
  const ruleBasedFigures = status === "EVIDENCE_REQUIRED" && !v.evaluation && v.rule_number === "Rule 18" && v.title === "Financial figure";
  const evidence = (ruleBasedFigures ? v.flagged_terms.join(", ") : "") || v.passage?.trim()
    || v.evaluation?.matched_text?.trim() || v.flagged_terms.join(", ");
  const reasoning = readableFindingReason(v.evaluation?.reasoning?.trim() || evidenceRequestExplanation(v) || v.explanation?.trim() || "");
  const heading = status === "NEEDS_REVIEW" ? "Why this needs review"
    : status === "EVIDENCE_REQUIRED" ? "Why this still needs verification" : status === "CLEARED" ? "Why this was cleared" : "Why this was flagged";
  const action = nextStep(v, status);
  const reviewNote = status === "NEEDS_REVIEW" ? "The AI has not confirmed a rule breach. Please check the concern before publishing." : null;
  return { evidence, reasoning, heading, action, reviewNote };
}

function nextStep(v: ComplianceViolation, status: string): string | null {
  if (status === "CLEARED") return null;
  const guidance = readableFindingReason(v.evaluation?.recommended_action?.trim() || v.remediation_guidance?.trim() || "");
  const visual = Boolean(v.image_regions?.length || v.image_file_ids?.length) || v.evaluation?.subject === "Visible asset content";
  if (status === "NEEDS_REVIEW" && visual && guidance) {
    return `Check the flagged area in the original image or video first. If you confirm the issue: ${guidance}`;
  }
  if (guidance && guidance !== readableFindingReason(v.evaluation?.reasoning?.trim() || v.explanation?.trim() || "")) return guidance;
  if (v.rule_number === "Rule 18") {
    return "Open Sources checked and find the passage that supports this claim. If it supports the claim, ask a reviewer to confirm the evidence. Otherwise, update the wording or add a source that supports it.";
  }
  return status === "NEEDS_REVIEW" ? "Check the flagged wording or image against this rule. Correct it if needed, or ask a reviewer to dismiss the flag if it does not apply."
    : "Review the flagged content against this rule, make the needed change, and run the check again.";
}
