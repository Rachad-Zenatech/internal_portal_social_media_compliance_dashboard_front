import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import { groupRule18, isRule18, rule18Penalty } from "@/lib/rule18Presentation";
import type { ComplianceViolation } from "@/services/complianceService";

type Finding = { v: ComplianceViolation; key: string };

export default function GroupedComplianceFindings<T extends Finding>({ findings, renderFinding, onClose }: {
  findings: T[];
  renderFinding: (finding: T, index: number) => ReactNode;
  onClose: () => void;
}) {
  const groups = groupRule18(findings, (finding) => finding.v);
  return <>{groups.map((group, index) => {
    const first = group[0];
    if (!isRule18(first.v)) return renderFinding(first, index);
    const penalty = rule18Penalty(group.map((finding) => finding.v));
    return (
      <details key="rule-18" className="group rounded-2xl border border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/5"
        onToggle={(event) => { if (!event.currentTarget.open) onClose(); }}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <RuleNumberBadge v={first.v} />
          <span>Supporting evidence</span>
          <span className="text-xs font-normal text-muted-foreground">{group.length} {group.length === 1 ? "claim" : "claims"} to check</span>
          <span className="ml-auto text-amber-700 dark:text-amber-300">{penalty > 0 ? `-${penalty} points` : "No points"}</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-amber-200 p-3 dark:border-amber-500/30">
          <p className="text-xs text-muted-foreground">Select a claim to see its evidence and highlight its location.</p>
          {group.map((finding) => renderFinding(finding, index))}
        </div>
      </details>
    );
  })}</>;
}
