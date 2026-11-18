import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Database, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ComplianceRule, RuleSelfTest } from "@/services/complianceService";

function ExampleBox({
  title,
  text,
  tone,
}: {
  title: string;
  text?: string | null;
  tone: "allowed" | "prohibited";
}) {
  const isAllowed = tone === "allowed";
  const boxCls = isAllowed
    ? "border-emerald-500/30 bg-emerald-500/5"
    : "border-red-500/30 bg-red-500/5";
  const titleCls = isAllowed
    ? "text-emerald-800 dark:text-emerald-300"
    : "text-red-800 dark:text-red-300";
  const Icon = isAllowed ? ShieldCheck : ShieldAlert;

  return (
    <div className={`rounded-lg border p-3 ${boxCls}`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${titleCls}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{title}</span>
      </p>
      {text ? (
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-foreground/90">{text}</p>
      ) : (
        <p className="mt-1.5 text-xs italic text-muted-foreground">None configured.</p>
      )}
    </div>
  );
}

function SelfTestList({ test }: { test?: RuleSelfTest }) {
  if (!test?.testable || test.results.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-3">
      <p className="text-xs font-semibold text-foreground">Automated self-test cases ({test.results.length})</p>
      <ul className="mt-2 space-y-1.5 text-xs">
        {test.results.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-muted-foreground">
                [{item.expected === "FLAG" ? "Should flag" : "Should pass"}]
              </span>{" "}
              <span className="italic text-foreground/90">&ldquo;{item.example}&rdquo;</span>
              {item.matched_terms.length > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  (matched: {item.matched_terms.map((t) => `"${t}"`).join(", ")})
                </span>
              )}
              {!item.ok && item.expected === "FLAG" && !item.quoted && (
                <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                  Imagery/visual description rather than exact phrasing (evaluated contextually/by reviewers).
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuleExamplesDetail({ rule, test }: { rule: ComplianceRule; test?: RuleSelfTest }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={4} className="px-4 py-4">
        <div className="space-y-3 pl-6">
          {rule.summary && <p className="text-xs text-muted-foreground">{rule.summary}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <ExampleBox title="Allowed examples (acceptable)" text={rule.allowed_examples} tone="allowed" />
            <ExampleBox title="Prohibited examples (not acceptable)" text={rule.prohibited_examples} tone="prohibited" />
          </div>
          {rule.remediation_guidance && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Remediation guidance:</span> {rule.remediation_guidance}
            </p>
          )}
          {(rule.prohibited_terms.length > 0 || (rule.exception_terms?.length ?? 0) > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {rule.prohibited_terms.length > 0 && (
                <>
                  <span className="font-medium text-muted-foreground">Trigger terms:</span>
                  {rule.prohibited_terms.map((term) => (
                    <Badge key={`p-${term}`} variant="outline" className="text-[11px] font-normal">
                      {term}
                    </Badge>
                  ))}
                </>
              )}
              {(rule.exception_terms?.length ?? 0) > 0 && (
                <>
                  <span className="ml-2 font-medium text-muted-foreground">Exceptions:</span>
                  {rule.exception_terms?.map((term) => (
                    <Badge key={`e-${term}`} variant="secondary" className="text-[11px] font-normal">
                      {term}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          )}
          <SelfTestList test={test} />
        </div>
      </td>
    </tr>
  );
}

function RuleRow({
  rule,
  test,
  expanded,
  onToggle,
}: {
  rule: ComplianceRule;
  test?: RuleSelfTest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const exampleCount = Number(Boolean(rule.allowed_examples)) + Number(Boolean(rule.prohibited_examples));
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors hover:bg-muted/40"
      >
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-expanded={expanded}
            className="flex w-full items-start gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0">
              <span className="block font-medium">
                {rule.rule_number} · {rule.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{rule.category}</span>
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {rule.evaluation_mode ?? "RULE"} · {rule.is_active ? "Active" : "Inactive"}
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline">
            {exampleCount} example{exampleCount === 1 ? "" : "s"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          {!test?.testable ? (
            <span className="text-xs text-muted-foreground">No self-test</span>
          ) : test.passed ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Passing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Needs review
            </span>
          )}
        </td>
      </tr>
      {expanded && <RuleExamplesDetail rule={rule} test={test} />}
    </>
  );
}

/** Expandable table of compliance rules and their allowed/prohibited training examples. */
export default function RuleDataTable({
  rules,
  tests,
}: {
  rules: ComplianceRule[];
  tests: RuleSelfTest[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const testByRule = new Map(tests.map((test) => [test.rule_id, test]));

  const toggleRule = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allExpanded = rules.length > 0 && expandedIds.size === rules.length;
  const toggleAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(rules.map((r) => r.id)));
  };

  return (
    <Card className="overflow-hidden py-0 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Configured training data</h2>
          <span className="text-xs text-muted-foreground">Click a rule to view or hide its examples</span>
        </div>
        {rules.length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Rule</th>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Examples</th>
              <th className="px-4 py-2.5 font-medium">Quality check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                test={testByRule.get(rule.id)}
                expanded={expandedIds.has(rule.id)}
                onToggle={() => toggleRule(rule.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
