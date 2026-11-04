import { Scale } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useComplianceRules } from "@/hooks/useComplianceRules";
import type { ComplianceViolation } from "@/services/complianceService";

/**
 * A flag's rule number; hovering it shows the rule that was broken. The rule is found by id, then by number, since
 * checks keep the number they were run with; when it's gone from the rulebook the flag's own title stands in.
 */
export default function RuleNumberBadge({ v }: { v: Pick<ComplianceViolation, "rule_number" | "title"> & { rule_id?: string } }) {
  const { data: rules } = useComplianceRules();
  const rule = (v.rule_id && rules?.find((r) => r.id === v.rule_id)) || rules?.find((r) => r.rule_number === v.rule_number);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex cursor-help items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <Scale className="h-3 w-3" />
          {v.rule_number}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-1 text-left">
        <span className="font-semibold">
          {v.rule_number} · {rule?.title ?? v.title}
        </span>
        {rule?.summary && <span className="font-normal opacity-90">{rule.summary}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
