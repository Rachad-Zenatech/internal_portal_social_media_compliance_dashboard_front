import { Ban } from "lucide-react";

import type { ComplianceCheckResponse } from "@/services/complianceService";

/**
 * How the compliance score was reached: 100, minus each finding's penalty, capped when a critical rule is broken.
 * Renders nothing for a clean check, or for checks saved before penalties were recorded.
 */
export default function ScoreBreakdown({
  check,
  className = "",
}: {
  check: Pick<ComplianceCheckResponse, "score" | "violations" | "blocked" | "score_cap" | "raw_score">;
  className?: string;
}) {
  const scored = check.violations.filter((v) => v.penalty != null);
  if (!check.blocked && scored.length === 0) return null;
  return (
    <div className={`space-y-1.5 text-[11px] ${className}`}>
      {check.blocked && (
        <p className="flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <Ban className="mt-px w-3.5 h-3.5 shrink-0" />
          <span>
            Blocked: a critical rule is broken, so it can't be published until that's fixed.
            {check.score_cap != null && ` The score is capped at ${check.score_cap} (${check.raw_score ?? "?"} before the cap).`}
          </span>
        </p>
      )}
      {scored.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-md border border-border/70">
          <li className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-muted-foreground">
            <span>Starting score</span>
            <span className="tabular-nums">100</span>
          </li>
          {scored.map((v) => (
            <li key={`${v.rule_id}-${v.kind ?? ""}`} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="font-semibold text-foreground">{v.rule_number}</span>
                <span className="text-muted-foreground"> · {v.kind === "MISSING_DISCLAIMER" ? "Missing disclaimer" : v.title}</span>
                {v.flagged_terms.length > 0 && (
                  <span className="block truncate text-muted-foreground">{v.flagged_terms.map((t) => `"${t}"`).join(", ")}</span>
                )}
              </span>
              {v.counted_with ? (
                <span className="shrink-0 text-right text-muted-foreground" title="The same words were already counted for a stricter rule">
                  0 · counted with {v.counted_with}
                </span>
              ) : (
                <span
                  className={`shrink-0 tabular-nums font-semibold ${
                    v.traffic_light === "RED" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  −{v.penalty}
                </span>
              )}
            </li>
          ))}
          {check.score_cap != null && (
            <li className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-red-700 dark:text-red-300">
              <span>Critical rule broken: capped</span>
              <span className="tabular-nums font-semibold">≤ {check.score_cap}</span>
            </li>
          )}
          <li className="flex items-center justify-between gap-3 px-2.5 py-1.5 font-semibold text-foreground">
            <span>Score</span>
            <span className="tabular-nums">{check.score}/100</span>
          </li>
        </ul>
      )}
    </div>
  );
}
