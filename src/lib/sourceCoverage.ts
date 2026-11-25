import type { SourceCheck, SourceClaim } from "@/services/complianceService";

export type CoveredSourceClaim = SourceClaim & { covered_by?: string };
export type CoveredSourceCheck = Omit<SourceCheck, "claims"> & { claims: CoveredSourceClaim[] };
export const sourceClaimKey = (claim: SourceClaim) => {
  // Match the backend assertion comparison: ignore spacing and list separators,
  // while retaining location, punctuation, numbers, negation and qualifications.
  const tokens = claim.claim.toLowerCase().replace(/\u2019/g, "'").match(/\d+(?:[.,]\d+)*|[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*|[^\s]/gu) ?? [];
  return `${claim.where}|${JSON.stringify(tokens.filter(token => ![",", ";", ":", "\u2022", "\u00b7"].includes(token)))}`;
};

export function sourceCoverageCounts(claims: CoveredSourceClaim[]) {
  return {
    ok: claims.filter(claim => claim.verdict === "SUPPORTED").length,
    covered: claims.filter(claim => Boolean(claim.covered_by)).length,
    wrong: claims.filter(claim => claim.verdict === "CONTRADICTED").length,
    open: claims.filter(claim => !claim.covered_by && ["NOT_FOUND", "UNCLEAR"].includes(claim.verdict)).length,
  };
}

/** Keep each source's verdict truthful while showing when another attachment covers the claim. */
export function withSourceCoverage(checks: SourceCheck[]): CoveredSourceCheck[] {
  const supported = new Map<string, string>();
  for (const source of checks) {
    if (source.status !== "READ") continue;
    for (const claim of source.claims) {
      if (claim.verdict === "SUPPORTED") supported.set(sourceClaimKey(claim), source.title || source.reference);
    }
  }
  return checks.map((source) => ({ ...source, claims: source.claims.map((claim): CoveredSourceClaim => ({
    ...claim,
    covered_by: ["NOT_FOUND", "UNCLEAR"].includes(claim.verdict) ? supported.get(sourceClaimKey(claim)) : undefined,
  })) }));
}
