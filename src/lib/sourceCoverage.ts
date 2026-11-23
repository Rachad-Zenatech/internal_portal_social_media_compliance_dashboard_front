import type { SourceCheck, SourceClaim } from "@/services/complianceService";

export type CoveredSourceClaim = SourceClaim & { covered_by?: string };
const key = (claim: SourceClaim) => `${claim.where}|${claim.claim.toLowerCase().replace(/\s+/g, " ").trim()}`;

/** Keep each source's verdict truthful while showing when another attachment covers the claim. */
export function withSourceCoverage(checks: SourceCheck[]): SourceCheck[] {
  const supported = new Map<string, string>();
  for (const source of checks) {
    if (source.status !== "READ") continue;
    for (const claim of source.claims) {
      if (claim.verdict === "SUPPORTED") supported.set(key(claim), source.title || source.reference);
    }
  }
  return checks.map((source) => ({ ...source, claims: source.claims.map((claim): CoveredSourceClaim => ({
    ...claim,
    covered_by: ["NOT_FOUND", "UNCLEAR"].includes(claim.verdict) ? supported.get(key(claim)) : undefined,
  })) }));
}
