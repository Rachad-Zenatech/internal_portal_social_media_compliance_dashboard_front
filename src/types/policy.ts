/** Social Media Content Policy: platform policy pages and the rules proposed from them for approval. */

export type PolicyPageStatus = "NEW" | "READ" | "NEEDS_TEXT" | "FAILED";
export type ProposalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED";

export interface PolicySource {
  platform: string;
  region: string;
  policy_name: string;
}

export interface PolicyPage {
  id: string;
  url: string;
  status: PolicyPageStatus;
  error?: string | null;
  fetch_method?: string | null;
  last_fetched_at?: string | null;
  last_changed_at?: string | null;
  text_chars: number;
  /** PENDING / RUNNING / DONE / FAILED: proposing rules from the latest text. */
  proposal_status?: string | null;
  proposal_error?: string | null;
  sources: PolicySource[];
  pending_count: number;
  approved_count: number;
}

export interface PolicyOverview {
  rulebook_id?: string | null;
  rulebook_title: string;
  pages: PolicyPage[];
  pending: number;
  refreshing: boolean;
}

/** An existing rule a proposal resembles. DUPLICATE: it already covers it. PARTIAL: it overlaps. */
export interface SimilarRule {
  rule_id?: string | null;
  rule_number: string;
  title: string;
  overlap: "DUPLICATE" | "PARTIAL";
  reason: string;
  score: number;
}

export interface PolicyRuleProposal {
  id: string;
  page_id: string;
  url: string;
  status: ProposalStatus;
  title: string;
  summary: string;
  severity: string;
  traffic_light: string;
  evaluation_mode: "RULE" | "CONTEXT";
  evaluation_guidance?: string | null;
  prohibited_terms: string[];
  exception_terms: string[];
  required_disclaimers: string[];
  disclaimer_triggers: string[];
  remediation_guidance?: string | null;
  platforms: string[];
  /** Empty: every region. */
  regions: string[];
  paid_ads_only: boolean;
  source_quote?: string | null;
  similar_rules: SimilarRule[];
  rule_id?: string | null;
  rule_number?: string | null;
  review_note?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  policy_names: string[];
}

export type ProposalUpdate = Partial<
  Pick<
    PolicyRuleProposal,
    | "title"
    | "summary"
    | "severity"
    | "traffic_light"
    | "evaluation_mode"
    | "evaluation_guidance"
    | "prohibited_terms"
    | "exception_terms"
    | "required_disclaimers"
    | "disclaimer_triggers"
    | "remediation_guidance"
    | "platforms"
    | "regions"
    | "paid_ads_only"
  >
>;
