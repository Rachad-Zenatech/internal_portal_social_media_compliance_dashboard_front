import type { SourceCheck } from "@/services/complianceService";

/** Show verified newsroom evidence and full-article read failures. */
export function visibleSourceChecks(checks: SourceCheck[]): SourceCheck[] {
  return checks.flatMap((source) => {
    if (source.where !== "newsroom" || source.status === "UNREADABLE") return [source];
    if (source.status !== "READ") return [];
    const claims = source.claims.filter((claim) => claim.verdict === "SUPPORTED" || claim.verdict === "CONTRADICTED");
    return claims.length > 0 ? [{ ...source, claims }] : [];
  });
}
