import type { StoredCheck } from "@/types/submission";
import type { CreatorFlagDismissalRequest } from "@/types/flagReview";

/** A routing threshold only: pending requests never change the actual approval score. */
export function reviewSendScore(check: StoredCheck | null | undefined, requests: CreatorFlagDismissalRequest[], version: number) {
  if (!check || check.analysis_pending || check.ai_unavailable) return undefined;
  const findings = check.violations ?? [];
  if (findings.some((finding) => finding.penalty == null)) return check.score;
  const sameTerms = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const requested = new Set(requests.filter((request) => request.status === "PENDING"
    && request.version_number === version && findings.some((finding) => finding.rule_id === request.rule_id
      && sameTerms(finding.flagged_terms ?? [], request.flagged_terms ?? []))).map((request) => request.rule_id));
  if (!requested.size) return check.score;
  const requestedFindings = findings.filter((finding) => requested.has(finding.rule_id));
  const numbers = new Set(requestedFindings.map((finding) => finding.rule_number));
  const remaining = findings.filter((finding) => !requested.has(finding.rule_id));
  const points = remaining.reduce((sum, finding) => sum + (finding.counted_with && numbers.has(finding.counted_with)
    ? finding.uncounted_penalty ?? 0 : finding.penalty ?? 0), 0);
  const refundable = requestedFindings.reduce((sum, finding) => sum + (finding.penalty ?? 0), 0);
  return Math.min(100, Math.max(0, 100 - points), check.score + refundable);
}
