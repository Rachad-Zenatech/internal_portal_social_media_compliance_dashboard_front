export type FlagDismissReason = "NEGATED" | "DIFFERENT_MEANING" | "ACCEPTABLE_IN_CONTEXT" | "RULE_TOO_BROAD" | "EVIDENCE_ON_FILE" | "OTHER";

/** A reviewer's dismissal of an automated compliance flag on one version. */
export interface FlagReview {
  rule_id: string;
  rule_number: string;
  version_number: number;
  flagged_terms: string[];
  traffic_light: string;
  reason: FlagDismissReason;
  reason_label: string;
  note?: string | null;
  decided_by_name?: string | null;
  decided_at: string;
}

/** A creator's request for a reviewer to dismiss a finding; it is not a dismissal itself. */
export interface CreatorFlagDismissalRequest extends FlagReview {
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by_name?: string | null;
}

/** A reviewer's call on a flag, kept as an example for the check: it was right, or a false alarm. */
export interface FlagVerdict {
  rule_id: string;
  rule_number: string;
  version_number: number;
  verdict: "CORRECT" | "OVER_FLAGGED";
  reason?: FlagDismissReason | null;
  reason_label?: string | null;
  note?: string | null;
  decided_by_name?: string | null;
  decided_at: string;
}

/** Per rule: how many submitted versions it flagged and how many of those flags reviewers dismissed. */
export interface RuleFlagStats {
  rule_number: string;
  flagged: number;
  dismissed: number;
  dismissal_rate?: number | null;
  top_reason?: string | null;
  top_reason_label?: string | null;
}
