import { CheckCircle2, Clock } from "lucide-react";

import { FlagCard } from "@/components/script/ScriptReviewWorkspace";
import { FINDING_ORDER, FindingGroup, groupFindings, statusOf } from "@/components/submissions/FindingStatus";
import { scriptVerdict } from "@/lib/scriptStage";
import type { StoredCheck } from "@/types/submission";

/** How many of a script's flags still need attention: cleared triggers aren't counted. */
export function activeFlagCount(check?: StoredCheck | null): number {
  return (check?.violations ?? []).filter((v) => statusOf(v) !== "CLEARED").length;
}

/**
 * A script's compliance check as the creator sees it: the score and what it means, then each flag with the rule it
 * broke, the wording that triggered it and how to fix it. The same flags the reviewer sees, to read (not to act on).
 */
export default function ScriptCompliance({ check }: { check?: StoredCheck | null }) {
  const verdict = scriptVerdict(check);
  const violations = check?.violations ?? [];
  const grouped = groupFindings(violations, statusOf);
  const flags = activeFlagCount(check);

  if (!check) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <Clock className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold text-foreground">Not checked yet</p>
        <p className="text-xs text-muted-foreground">The check runs when the script is sent for review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-xl border bg-card px-4 py-3 ${verdict.ring}`}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold leading-none text-foreground">{check.ai_unavailable || check.score == null ? "–" : check.score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <span className={`text-sm font-semibold ${verdict.tone}`}>{verdict.text}</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {check.ai_unavailable
            ? "The AI review couldn't run, so there is no score yet. It is checked again automatically."
            : flags === 0
              ? "Nothing in this script broke a rule."
              : `${flags} flag${flags === 1 ? "" : "s"} to look at${verdict.critical ? `, ${verdict.critical} critical` : ""}. Each shows the rule, the wording and how to fix it.`}
        </p>
      </div>

      {violations.length === 0 ? (
        !check.ai_unavailable && (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-foreground">No rulebook flags</p>
          </div>
        )
      ) : (
        FINDING_ORDER.map((status) => (
          <FindingGroup key={status} status={status} count={grouped[status].length}>
            {grouped[status].map((v) => (
              <FlagCard key={`${v.rule_id}-${v.flagged_terms.join("|")}`} v={v} canEdit={false} />
            ))}
          </FindingGroup>
        ))
      )}
    </div>
  );
}
