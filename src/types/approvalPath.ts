/** Who gives final approval for which content. Empty brand or audience: any. */
export interface ApprovalPathInput {
  brand_code: string | null;
  audience: string | null;
  /** Only Shaun's own posts (his account or his rule set). */
  ceo_content: boolean;
  label: string | null;
  approver_ids: string[];
}

export interface ApprovalPath extends ApprovalPathInput {
  id: string;
  approver_names: string[];
  created_at: string;
  updated_at: string;
}

export interface ApproverOption {
  id: string;
  name: string;
  email: string;
  /** Brands they work on; empty means every brand. */
  brands: string[];
}

export interface ApprovalPathOptions {
  approvers: ApproverOption[];
  brands: { code: string; name: string }[];
  audiences: Record<string, string>;
}
