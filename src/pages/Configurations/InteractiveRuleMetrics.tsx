import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Database, FileCheck2, Landmark, Loader2, ShieldCheck, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { complianceService, type ComplianceRule, type RuleSelfTest } from "@/services/complianceService";
import RuleDataTable from "./RuleTrainingTable";

type MetricKey = "rules" | "examples" | "selftests" | "safeguards" | "triggers" | "evidence";

const FINANCE_RE = /investment|investor|financial|revenue|profit|return|stock|share|market|disclosure|earnings|guidance/i;
const EVIDENCE_RE = /evidence|substantiate|disclosure/i;

function isFinanceRule(r: ComplianceRule): boolean {
  return FINANCE_RE.test([r.title, r.category, r.summary, ...r.prohibited_terms, ...r.required_disclaimers].join(" "));
}

function isEvidenceRule(r: ComplianceRule): boolean {
  return r.is_active && isFinanceRule(r) && (r.required_disclaimers.length > 0 || EVIDENCE_RE.test(`${r.title} ${r.summary}`));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-primary/60 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground group-hover:text-primary">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail} · Click for details</p>
    </button>
  );
}

function MetricDetailDialog({
  metric,
  rules,
  tests,
  onClose,
}: {
  metric: MetricKey | null;
  rules: ComplianceRule[];
  tests: RuleSelfTest[];
  onClose: () => void;
}) {
  if (!metric) return null;
  const financeActive = rules.filter((r) => r.is_active && isFinanceRule(r));
  const evidenceRules = rules.filter(isEvidenceRule);
  const tested = tests.filter((t) => t.testable);

  const titles: Record<MetricKey, { title: string; subtitle: string }> = {
    rules: { title: `Configured rules (${rules.length})`, subtitle: "Every compliance rule configured in the portal and its scope/category." },
    examples: { title: "Training examples (Allowed & Prohibited)", subtitle: "The exact allowed and prohibited example sentences on each rule." },
    selftests: { title: `Self-tests (${tested.filter((t) => t.passed).length}/${tested.length} passing)`, subtitle: "Automated verification of each rule's trigger terms against its examples." },
    safeguards: { title: `Investor safeguards (${financeActive.length} active rules)`, subtitle: "Active rules covering financial communications, stock, earnings, and investor claims." },
    triggers: { title: "Claim triggers (Financial terms & disclaimer triggers)", subtitle: "The exact prohibited terms and disclaimer trigger phrases across the investor safeguard rules." },
    evidence: { title: `Evidence controls (${evidenceRules.length} rules)`, subtitle: "The 5 financial rules that require supporting evidence, substantiation, or mandatory disclosures." },
  };

  const list =
    metric === "safeguards" || metric === "triggers"
      ? financeActive
      : metric === "evidence"
      ? evidenceRules
      : rules;

  return (
    <Dialog open={Boolean(metric)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titles[metric].title}</DialogTitle>
          <DialogDescription>{titles[metric].subtitle}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1 text-xs">
          {metric === "selftests"
            ? tested.map((t) => (
                <div key={t.rule_id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Rule {t.rule_number} · {t.title}</span>
                    <span className={t.passed ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                      {t.passed ? "Passing" : "Needs review"}
                    </span>
                  </div>
                  {t.cases.map((c, idx) => (
                    <p key={idx} className="mt-1 text-muted-foreground">
                      [{c.expect_flag ? "Should flag" : "Allowed"}] “{c.text}” {c.matched_terms.length > 0 && `(matched: ${c.matched_terms.join(", ")})`}
                    </p>
                  ))}
                </div>
              ))
            : list.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Rule {r.rule_number} · {r.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{r.category}</span>
                  </div>
                  <p className="text-muted-foreground">{r.summary}</p>
                  {metric === "examples" && (
                    <div className="space-y-1 pt-1">
                      {r.allowed_examples && <p className="text-emerald-700 dark:text-emerald-300"><strong>Allowed:</strong> {r.allowed_examples}</p>}
                      {r.prohibited_examples && <p className="text-red-700 dark:text-red-300"><strong>Prohibited:</strong> {r.prohibited_examples}</p>}
                    </div>
                  )}
                  {metric === "triggers" && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[...r.prohibited_terms, ...r.disclaimer_triggers].map((term, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{term}</span>
                      ))}
                    </div>
                  )}
                  {metric === "evidence" && (
                    <div className="space-y-1 pt-1 text-muted-foreground">
                      {r.required_disclaimers.length > 0 && (
                        <p><strong>Required disclaimer:</strong> {r.required_disclaimers.join(" · ")}</p>
                      )}
                      {r.remediation_guidance && <p><strong>Evidence / Remediation guidance:</strong> {r.remediation_guidance}</p>}
                    </div>
                  )}
                </div>
              ))}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export default function InteractiveRuleMetrics() {
  const [openSection, setOpenSection] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const rulesQuery = useQuery({ queryKey: ["training-data", "rules"], queryFn: () => complianceService.getRules() });
  const testsQuery = useQuery({ queryKey: ["training-data", "self-tests"], queryFn: complianceService.selfTest });

  if (rulesQuery.isLoading || testsQuery.isLoading) {
    return (
      <Card className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading compliance & finance training metrics…
      </Card>
    );
  }
  const rules = rulesQuery.data ?? [];
  const tests = testsQuery.data ?? [];
  const active = rules.filter((r) => r.is_active).length;
  const tested = tests.filter((t) => t.testable);
  const passed = tested.filter((t) => t.passed).length;
  const examples = rules.reduce((n, r) => n + Number(Boolean(r.allowed_examples)) + Number(Boolean(r.prohibited_examples)), 0);
  const financeActive = rules.filter((r) => r.is_active && isFinanceRule(r));
  const triggers = financeActive.reduce((n, r) => n + r.prohibited_terms.length + r.disclaimer_triggers.length, 0);
  const evidence = rules.filter(isEvidenceRule).length;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Configured rules" value={rules.length} detail={`${active} active`} icon={Database} onClick={() => setSelectedMetric("rules")} />
        <MetricCard label="Training examples" value={examples} detail="Allowed and prohibited examples" icon={ShieldCheck} onClick={() => setSelectedMetric("examples")} />
        <MetricCard label="Self-tests passing" value={`${passed}/${tested.length}`} detail={tested.length ? `${Math.round((passed / tested.length) * 100)}% pass rate` : "No tests"} icon={CheckCircle2} onClick={() => setSelectedMetric("selftests")} />
      </section>

      <Card className="overflow-hidden py-0 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <Landmark className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Finance-content coverage</h2>
          <span className="text-xs text-muted-foreground">Click any metric to inspect the exact rules, triggers, or evidence controls</span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <MetricCard label="Investor safeguards" value={financeActive.length} detail="Active rules covering financial communications" icon={ShieldCheck} onClick={() => setSelectedMetric("safeguards")} />
          <MetricCard label="Claim triggers" value={triggers} detail="Return, price, revenue, and disclosure signals" icon={TrendingUp} onClick={() => setSelectedMetric("triggers")} />
          <MetricCard label="Evidence controls" value={evidence} detail="Rules that require support or a disclosure" icon={FileCheck2} onClick={() => setSelectedMetric("evidence")} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
          <span>Recommended evidence source for a finance claim: filing and XBRL data from the SEC’s EDGAR APIs.</span>
          <a className="font-medium text-primary hover:underline" href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">View SEC EDGAR data</a>
        </div>
      </Card>

      <div>
        <button type="button" onClick={() => setOpenSection((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSection ? "rotate-180" : ""}`} />
          <span>{openSection ? "Hide full rulebook examples table" : "Show full rulebook examples table"}</span>
        </button>
        {openSection && <div className="mt-3"><RuleDataTable rules={rules} tests={tests} /></div>}
      </div>

      <MetricDetailDialog metric={selectedMetric} rules={rules} tests={tests} onClose={() => setSelectedMetric(null)} />
    </div>
  );
}
