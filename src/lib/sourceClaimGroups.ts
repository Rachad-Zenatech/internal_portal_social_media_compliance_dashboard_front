import type { SourceCheck, SourceClaim } from "@/services/complianceService";
import { sourceClaimKey } from "@/lib/sourceCoverage";
import { visibleSourceChecks } from "@/lib/sourceCheckVisibility";

export type UnmatchedSourceClaim = SourceClaim & { locations: SourceClaim["where"][] };
const assertionKey = (claim: SourceClaim) => sourceClaimKey(claim).replace(/^[^|]+\|/, "");

/** An omission in an unrelated article is not a finding about that article. */
export function sourceClaimGroups(checks: SourceCheck[]) {
  const connected = new Set<string>();
  for (const source of checks) {
    if (source.status !== "READ") continue;
    for (const claim of source.claims) {
      if (claim.verdict === "SUPPORTED" || claim.verdict === "CONTRADICTED") connected.add(assertionKey(claim));
    }
  }
  const unmatched = new Map<string, UnmatchedSourceClaim>();
  for (const source of checks) {
    for (const claim of source.claims) {
      const key = assertionKey(claim);
      if (["NOT_FOUND", "UNCLEAR"].includes(claim.verdict) && !connected.has(key)) {
        const previous = unmatched.get(key);
        const locations = [...new Set([...(previous?.locations ?? []), claim.where])];
        unmatched.set(key, { ...(previous ?? claim), locations });
      }
    }
  }
  const sources = visibleSourceChecks(checks).map(source => ({ ...source, claims: source.claims.filter(
    claim => source.status === "READ" && ["SUPPORTED", "CONTRADICTED"].includes(claim.verdict),
  ) }));
  return { sources, unmatched: [...unmatched.values()] };
}
