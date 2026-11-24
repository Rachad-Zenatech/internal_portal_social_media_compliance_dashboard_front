import type { StoredCheck } from "@/types/submission";
import type { IncompleteCheckStage } from "@/types/checkDiagnostics";

const LABELS: Record<IncompleteCheckStage["stage"], string> = {
  RULEBOOK: "Rulebook meaning check", CLAIM_EXTRACTION: "Claim identification",
  SOURCE_VERIFICATION: "Source verification", SOURCE_RETRIEVAL: "Finding supporting material",
  CONTEXT_REVIEW: "Context review", VISUAL_REVIEW: "Visual review",
};

/** Read explicit diagnostics, with conservative explanations for previously saved checks. */
export function incompleteCheckDetails(check?: StoredCheck) {
  const stages = [...(check?.incomplete_stages ?? [])];
  if (!stages.length && check?.ai_unavailable) {
    if (check.source_checks?.some(source => /no ai model could compare|could not compare|couldn't compare/i.test(source.message ?? ""))) {
      stages.push({ stage: "SOURCE_VERIFICATION", reason: "The sources were read, but their claims could not be fully compared." });
    }
    if (check.visual_checks?.some(item => item.status === "UNAVAILABLE")) {
      stages.push({ stage: "VISUAL_REVIEW", reason: "One or more images or videos could not be fully reviewed." });
    }
    if (check.violations?.some(item => item.evaluation?.source === "UNAVAILABLE")) {
      stages.push({ stage: "CONTEXT_REVIEW", reason: "Some flagged wording could not be evaluated in context." });
    }
  }
  return {
    title: stages.length === 1 ? `${LABELS[stages[0].stage]} did not finish` : "The compliance review did not finish",
    reasons: [...new Set(stages.map(item => `${LABELS[item.stage]}: ${item.reason}`))],
  };
}
