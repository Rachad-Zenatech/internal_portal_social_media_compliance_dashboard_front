import { Check } from "lucide-react";

import { useSourceConfirmations } from "@/hooks/useSourceConfirmations";
import type { ComplianceViolation } from "@/services/complianceService";
import type { StoredCheck } from "@/types/submission";

export function useManuallyCheckedClaims(submissionId: string | undefined, check: StoredCheck | null) {
  const sources = check?.source_checks ?? [];
  const urls = [...new Set(sources.flatMap((source) =>
    [source.url, ...source.claims.map((claim) => claim.source_url)].filter((url): url is string => Boolean(url))
  ))];
  const calls = useSourceConfirmations(urls.length ? submissionId : undefined, urls);
  const confirmed = new Set(sources.flatMap((source) => source.claims.flatMap((claim) => {
    const url = claim.source_url || source.url;
    return url && (claim.verdict === "UNCLEAR" || claim.verdict === "NOT_FOUND") && calls.mine(url, claim.claim)?.matches === true
      ? [claim.claim] : [];
  })));
  return (finding: ComplianceViolation) => finding.category === "Source Check" && finding.status === "NEEDS_REVIEW"
    && finding.flagged_terms.some((term) => confirmed.has(term));
}

export default function ManuallyCheckedClaims({ findings }: { findings: ComplianceViolation[] }) {
  if (!findings.length) return null;
  return (
    <details className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
      <summary className="cursor-pointer font-semibold">{findings.length} checked by you</summary>
      <p className="mt-2">Your source assessment is saved for the reviewer. The compliance score stays the same.</p>
      <ul className="mt-2 space-y-1.5">
        {findings.map((finding) => (
          <li key={finding.rule_id} className="flex items-start gap-2">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{finding.flagged_terms.join(", ")}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
