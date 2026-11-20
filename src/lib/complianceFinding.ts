import type { ComplianceViolation } from "@/services/complianceService";

/** Unavailable and rule-based checks have no model confidence estimate. */
export function isVisibleFinding(v: Pick<ComplianceViolation, "status" | "evaluation">): boolean {
  const e = v.evaluation;
  return !(v.status === "NEEDS_REVIEW" && e && e.source !== "UNAVAILABLE" && e.confidence < 0.5);
}

export function findingConfidence(v: Pick<ComplianceViolation, "evaluation">): string | null {
  const e = v.evaluation;
  if (!e || e.source === "UNAVAILABLE" || !Number.isFinite(e.confidence)) return null;
  return `AI confidence: ${Math.round(e.confidence * 100)}%`;
}
