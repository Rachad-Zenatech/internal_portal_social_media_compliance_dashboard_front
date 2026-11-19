import { useState } from "react";
import { CircleHelp, ListChecks } from "lucide-react";
import { coverageOf, visibleRuleResults, type CoverageFilter } from "@/lib/ruleCoverage";
import { CHECKING_METHOD_LABELS, RULE_OUTCOME_LABELS, type MethodCheckResult, type RuleCheckResult } from "@/types/ruleCheck";
import type { ComplianceCheckResponse } from "@/services/complianceService";

const FILTERS = { ALL: "All results", INCOMPLETE: "Incomplete", ...RULE_OUTCOME_LABELS };
const OUTCOME_TONE = { NO_ISSUE_FOUND: "text-emerald-700", ISSUE: "text-red-700", EVIDENCE_REQUIRED: "text-amber-800", HUMAN_REVIEW_REQUIRED: "text-amber-800", NOT_APPLICABLE: "text-muted-foreground" };

function MethodRow({ item }: { item: MethodCheckResult }) {
  const label = item.complete && item.outcome ? RULE_OUTCOME_LABELS[item.outcome] : "Incomplete";
  return <li className="space-y-0.5"><p className="font-medium">{CHECKING_METHOD_LABELS[item.method]} <span className="font-normal text-muted-foreground">- {label}</span></p><p className="text-muted-foreground">{item.reason}</p></li>;
}

function RuleResultRow({ result }: { result: RuleCheckResult }) {
  const label = result.outcome ? RULE_OUTCOME_LABELS[result.outcome] : "Incomplete";
  const tone = result.outcome ? OUTCOME_TONE[result.outcome] : "text-amber-800";
  const unfinished = !result.complete && Boolean(result.outcome);
  return (
    <li className="space-y-2 rounded-xl border border-border/70 bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 font-semibold text-foreground">{result.rule_number}: {result.title}</p><span className={`text-xs font-semibold ${tone}`}>{label}</span></div>
      {unfinished && <p className="text-xs font-medium text-amber-800">Some configured checks are incomplete</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">{result.reason}</p>
      <details className="text-xs"><summary className="cursor-pointer font-medium text-foreground">Checking methods ({result.methods.length})</summary><ul className="mt-2 space-y-3">{result.methods.map((item) => <MethodRow key={item.method} item={item} />)}</ul></details>
    </li>
  );
}

export default function RuleCheckResults({ check }: { check: ComplianceCheckResponse }) {
  const [filter, setFilter] = useState<CoverageFilter>("ALL");
  const coverage = coverageOf(check);
  const visible = visibleRuleResults(coverage.rows, filter);
  const changeFilter = (event: React.ChangeEvent<HTMLSelectElement>) => setFilter(event.target.value as CoverageFilter);
  const summary = `${coverage.complete} of ${coverage.total} rules have recorded results`;
  if (coverage.legacy) return <p className="flex gap-2 rounded-lg border border-border/70 p-3 text-xs text-muted-foreground"><CircleHelp className="size-4 shrink-0" />This saved check has no per-rule coverage record. Check again to see which rules were evaluated.</p>;
  if (coverage.total === 0) return <p className="text-xs text-muted-foreground">No active rules applied to this submission's scope.</p>;
  return (
    <details className="rounded-xl border border-border/70 bg-muted/10 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 font-semibold text-foreground"><ListChecks className="size-4" />Rule checks<span className="font-normal text-muted-foreground">{summary}</span>{coverage.attention > 0 && <span className="text-xs text-muted-foreground">{coverage.attention} for review</span>}{coverage.incomplete > 0 && <span className="text-xs text-amber-800 dark:text-amber-300">{coverage.incomplete} incomplete</span>}</summary>
      <div className="space-y-3 border-t border-border/60 p-3">
        {coverage.incomplete > 0 && <p className="text-xs leading-relaxed text-amber-800">Some configured checks have not finished. They are not recorded as passed. During benchmarking, this does not add a submission block.</p>}
        {coverage.missing > 0 && <p className="text-xs text-amber-800">{coverage.missing} applicable rule(s) have no saved result.</p>}
        <label className="flex flex-wrap items-center gap-2 text-xs font-medium">Show<select value={filter} onChange={changeFilter} className="rounded-md border border-border bg-background px-2 py-1.5">{Object.entries(FILTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <ul className="space-y-2">{visible.map((row) => <RuleResultRow key={row.rule_id} result={row} />)}</ul>
        {visible.length === 0 && <p className="text-xs text-muted-foreground">No results in this category.</p>}
      </div>
    </details>
  );
}
