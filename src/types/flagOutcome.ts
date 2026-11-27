export interface FlagOutcome {
  rule_id: string;
  rule_number: string;
  version_number: number;
  outcome: "DISMISSED" | "APPROVED" | "REJECTED";
  reason: string;
  note?: string | null;
  reviewer_name?: string | null;
  decided_at?: string | null;
}
