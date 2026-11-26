import type { ComplianceViolation } from "@/services/complianceService";

/** Unavailable and rule-based checks have no model confidence estimate. */
export function isVisibleFinding(v: Pick<ComplianceViolation, "status" | "evaluation"> & Partial<Pick<ComplianceViolation, "rule_number">>): boolean {
  const e = v.evaluation;
  const number = v.rule_number?.replace(/^rule\s*/i, "").trim();
  if (number === "25" && ["VIOLATION", "NEEDS_REVIEW", "EVIDENCE_REQUIRED"].includes(v.status ?? "VIOLATION")) {
    return Boolean(e && (e.source === "AI" || e.source === "ADJUSTED") && e.confidence >= 0.7);
  }
  const rule18 = number === "18";
  if (rule18 && ["VIOLATION", "NEEDS_REVIEW", "EVIDENCE_REQUIRED"].includes(v.status ?? "VIOLATION")
      && e && (e.source === "AI" || e.source === "ADJUSTED")) return e.confidence >= 0.7;
  return !(v.status === "NEEDS_REVIEW" && e && e.source !== "UNAVAILABLE" && e.confidence < 0.5);
}

export function findingConfidence(v: Pick<ComplianceViolation, "evaluation"> & Partial<Pick<ComplianceViolation, "status">>): string | null {
  const e = v.evaluation;
  if (!e) return v.status === "EVIDENCE_REQUIRED" ? "AI confidence: not assessed (rule-based check)" : null;
  if (e.source === "UNAVAILABLE" || !Number.isFinite(e.confidence)) return null;
  return `AI confidence: ${Math.round(e.confidence * 100)}%`;
}

/** Explain an unresolved evidence request without implying that no source was attached. */
export function evidenceRequestExplanation(v: ComplianceViolation): string | null {
  if (v.status !== "EVIDENCE_REQUIRED" || v.evaluation?.reasoning?.trim()) return null;
  if (v.rule_number === "Rule 18" && v.title === "Financial figure") {
    return "We found financial amounts in your post, but this check has not confirmed the evidence for all of them. If a source is already attached, open Sources checked and confirm each amount and what it refers to. Equivalent wording is acceptable; the amounts and their meaning must agree.";
  }
  return "This check has not confirmed that a source supports this claim. You may already have a source attached; open Sources checked to see whether it covers this specific statement.";
}
