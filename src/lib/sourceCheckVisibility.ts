import type { SourceCheck } from "@/services/complianceService";

/** Automatic newsroom summaries only surface corroboration or an explicit conflict. */
export function visibleSourceChecks(checks: SourceCheck[]): SourceCheck[] {
  return checks.flatMap((source) => {
    if (source.where !== "newsroom") return [source];
    if (source.status !== "READ") return [];
    const claims = source.claims.filter((claim) => claim.verdict === "SUPPORTED" || claim.verdict === "CONTRADICTED");
    return claims.length > 0 ? [{ ...source, claims }] : [];
  });
}
