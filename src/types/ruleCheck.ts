export type CheckingMethod = "TEXT_ANALYSIS" | "VISUAL_INSPECTION" | "SOURCE_VERIFICATION" | "CLEARANCE_DOCUMENTS" | "HUMAN_CONFIRMATION";
export type RuleOutcome = "NO_ISSUE_FOUND" | "ISSUE" | "EVIDENCE_REQUIRED" | "HUMAN_REVIEW_REQUIRED" | "NOT_APPLICABLE";

export interface MethodCheckResult {
  method: CheckingMethod;
  outcome?: RuleOutcome | null;
  complete: boolean;
  reason: string;
}

export interface RuleCheckResult {
  rule_id: string;
  rule_number: string;
  title: string;
  outcome?: RuleOutcome | null;
  complete: boolean;
  reason: string;
  methods: MethodCheckResult[];
}

export const CHECKING_METHOD_LABELS: Record<CheckingMethod, string> = {
  TEXT_ANALYSIS: "Text analysis",
  VISUAL_INSPECTION: "Image / video inspection",
  SOURCE_VERIFICATION: "Source verification",
  CLEARANCE_DOCUMENTS: "Clearance documents",
  HUMAN_CONFIRMATION: "Human confirmation",
};

export const RULE_OUTCOME_LABELS: Record<RuleOutcome, string> = {
  NO_ISSUE_FOUND: "No issue found", ISSUE: "Issue", EVIDENCE_REQUIRED: "Evidence required",
  HUMAN_REVIEW_REQUIRED: "Human review required", NOT_APPLICABLE: "Not applicable",
};
