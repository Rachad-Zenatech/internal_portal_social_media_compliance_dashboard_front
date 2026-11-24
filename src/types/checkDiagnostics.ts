export interface IncompleteCheckStage {
  stage: "RULEBOOK" | "CLAIM_EXTRACTION" | "SOURCE_VERIFICATION" | "SOURCE_RETRIEVAL" | "CONTEXT_REVIEW" | "VISUAL_REVIEW";
  reason: string;
  code?: string | null;
}
