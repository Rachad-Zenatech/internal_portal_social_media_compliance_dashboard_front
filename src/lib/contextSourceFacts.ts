import type { SourceCheck, SourceClaim } from "@/services/complianceService";
import type { ContextFeedback } from "@/lib/contextFeedback";
import { visibleSourceChecks } from "@/lib/sourceCheckVisibility";

export function claimKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

type ComparedClaim = { source: SourceCheck; claim: SourceClaim };

function sourceFeedback(rows: ComparedClaim[]): ContextFeedback {
  const contradicted = rows.find((row) => row.claim.verdict === "CONTRADICTED");
  const supported = rows.find((row) => row.claim.verdict === "SUPPORTED");
  const selected = contradicted ?? supported ?? rows[0];
  const { source, claim } = selected;
  const attention = claim.verdict !== "SUPPORTED";
  const titles = { SUPPORTED: "Supported by a source", CONTRADICTED: supported ? "Sources disagree on this claim" : "Source says something different", NOT_FOUND: "Claim not found in this source", UNCLEAR: "Source needs confirmation" };
  const improvement = !attention ? undefined : claim.note || "Check this claim against the cited source. Add supporting evidence or revise the wording to match it.";
  const reference = [...new Set(rows.filter((row) => row.claim.verdict === selected.claim.verdict || row === selected).map((row) => row.source.title || row.source.reference))].join("; ");
  const reason = claim.evidence || claim.source_quote || claim.note || (attention ? "The cited source does not clearly support the quoted claim." : "This source supports the quoted claim.");
  return { title: titles[claim.verdict], evidence: claim.claim, reason, improvement, reference, sourceUrl: claim.source_url || source.url, attention };
}

/** Read the actual compliance source comparisons, including the newsroom, without inventing new checks. */
export function contextSourceFacts(checks: SourceCheck[]): ContextFeedback[] {
  const groups = new Map<string, ComparedClaim[]>();
  for (const source of visibleSourceChecks(checks)) {
    if (source.status !== "READ") continue;
    for (const claim of source.claims) {
      if (!claim.claim.trim()) continue;
      const key = claimKey(claim.claim);
      groups.set(key, [...(groups.get(key) ?? []), { source, claim }]);
    }
  }
  return [...groups.values()].map(sourceFeedback);
}
