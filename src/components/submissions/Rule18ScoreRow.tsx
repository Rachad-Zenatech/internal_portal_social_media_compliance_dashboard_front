import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import { rule18Penalty } from "@/lib/rule18Presentation";
import type { ComplianceViolation } from "@/services/complianceService";

export default function Rule18ScoreRow({ findings }: { findings: ComplianceViolation[] }) {
  const penalty = rule18Penalty(findings);
  return (
    <li className="flex items-start justify-between gap-3 px-2.5 py-1.5">
      <span><RuleNumberBadge v={findings[0]} /><span className="ml-1 text-muted-foreground">Supporting evidence - see claims below</span></span>
      <span className="shrink-0 font-semibold tabular-nums text-amber-700 dark:text-amber-300">-{penalty}</span>
    </li>
  );
}
