import type { ComplianceCheckResponse } from "@/services/complianceService";
import type { RuleCheckResult, RuleOutcome } from "@/types/ruleCheck";

export type CoverageFilter = "ALL" | "INCOMPLETE" | RuleOutcome;
const order = { ISSUE: 0, EVIDENCE_REQUIRED: 1, HUMAN_REVIEW_REQUIRED: 2, NO_ISSUE_FOUND: 3, NOT_APPLICABLE: 4 };

/** Count saved judgments conservatively; a missing row never counts as evaluated. */
export function coverageOf(check: Pick<ComplianceCheckResponse, "rule_results" | "rule_results_version" | "rules_checked">) {
  const rows = [...new Map((check.rule_results ?? []).map((row) => [row.rule_id, row])).values()];
  const total = Math.max(check.rules_checked ?? rows.length, rows.length);
  const complete = rows.filter((row) => row.complete).length;
  const missing = total - rows.length;
  const attention = rows.filter((row) => row.outcome && ["ISSUE", "EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"].includes(row.outcome)).length;
  rows.sort((a, b) => Number(a.complete) - Number(b.complete) || (a.outcome ? order[a.outcome] : -1) - (b.outcome ? order[b.outcome] : -1));
  return { rows, total, complete, attention, incomplete: total - complete, missing, legacy: !check.rule_results_version };
}

export function visibleRuleResults(rows: RuleCheckResult[], filter: CoverageFilter): RuleCheckResult[] {
  if (filter === "ALL") return rows;
  if (filter === "INCOMPLETE") return rows.filter((row) => !row.complete);
  return rows.filter((row) => row.outcome === filter);
}
