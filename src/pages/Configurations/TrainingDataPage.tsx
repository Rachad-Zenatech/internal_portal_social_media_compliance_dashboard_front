import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { complianceService, type ComplianceRule, type RuleSelfTest } from "@/services/complianceService";
import { submissionService } from "@/services/submissionService";
import type { AiUsage } from "@/types/sentiment";

function QualitySummary({ rules, tests }: { rules: ComplianceRule[]; tests: RuleSelfTest[] }) {
  const active = rules.filter((rule) => rule.is_active).length;
  const tested = tests.filter((test) => test.testable);
  const passed = tested.filter((test) => test.passed).length;
  const examples = rules.reduce((total, rule) => total + Number(Boolean(rule.allowed_examples)) + Number(Boolean(rule.prohibited_examples)), 0);
  const metrics = [
    { label: "Configured rules", value: rules.length, detail: `${active} active`, icon: Database },
    { label: "Training examples", value: examples, detail: "Allowed and prohibited examples", icon: ShieldCheck },
    { label: "Self-tests passing", value: `${passed}/${tested.length}`, detail: tested.length ? `${Math.round((passed / tested.length) * 100)}% quality check pass rate` : "No testable examples yet", icon: CheckCircle2 },
  ];

  return <section className="grid gap-3 sm:grid-cols-3">{metrics.map(({ label, value, detail, icon: Icon }) => <Card key={label} className="p-4 shadow-xs"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></Card>)}</section>;
}

function AiCapacity({ usage }: { usage?: AiUsage }) {
  if (!usage) return <Card className="p-5 text-sm text-muted-foreground">AI capacity data is unavailable.</Card>;
  const services = [["SENTIMENT", "Sentiment"], ["TRANSCRIPTION", "Transcription"], ["PUBLIC_MOOD", "Public mood"], ["CAPTION", "Caption"]] as const;
  return <Card className="overflow-hidden py-0 shadow-xs"><div className="flex items-center gap-2 border-b border-border/70 px-4 py-3"><Activity className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">AI service capacity</h2><span className="text-xs text-muted-foreground">Rolling 24-hour usage</span></div><Tabs defaultValue="SENTIMENT" className="gap-0"><div className="overflow-x-auto border-b border-border/70 px-2"><TabsList className="h-auto w-max min-w-full justify-start bg-transparent p-1">{services.map(([feature, label]) => <TabsTrigger key={feature} value={feature} className="shrink-0">{label}</TabsTrigger>)}</TabsList></div>{services.map(([feature, label]) => { const limit = usage[feature]; const personalPercent = limit.limit ? Math.min(100, (limit.used / limit.limit) * 100) : 0; const companyPercent = limit.company_limit ? Math.min(100, (limit.company_used / limit.company_limit) * 100) : 0; return <TabsContent key={feature} value={feature} className="m-0 p-4 sm:p-5"><div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"><div><h3 className="font-semibold">{label}</h3><p className="text-sm text-muted-foreground">Service-specific capacity and shared tenant usage</p></div><p className="text-xs text-muted-foreground">{limit.resets_at ? `Resets ${new Date(limit.resets_at).toLocaleString()}` : "Rolling 24-hour window"}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><CapacityMetric label="Your usage" value={limit.limit ? `${limit.used} / ${limit.limit}` : `${limit.used} used`} percent={personalPercent} /><CapacityMetric label="Company usage" value={limit.company_limit ? `${limit.company_used} / ${limit.company_limit}` : `${limit.company_used} used`} percent={companyPercent} /><div className="rounded-lg border border-border/70 bg-muted/30 p-3"><p className="text-xs font-medium text-muted-foreground">Available to you</p><p className="mt-1 text-xl font-semibold">{limit.remaining === null ? "Unlimited" : limit.remaining}</p><p className="mt-1 text-xs text-muted-foreground">{limit.remaining === null ? "No personal limit" : "runs remaining"}</p></div></div></TabsContent>; })}</Tabs></Card>;
}

function CapacityMetric({ label, value, percent }: { label: string; value: string; percent: number }) {
  return <div className="rounded-lg border border-border/70 p-3"><div className="flex justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm font-semibold">{value}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className={percent >= 90 ? "h-full bg-amber-500" : "h-full bg-primary"} style={{ width: `${percent}%` }} /></div></div>;
}

function RuleDataTable({ rules, tests }: { rules: ComplianceRule[]; tests: RuleSelfTest[] }) {
  const testByRule = new Map(tests.map((test) => [test.rule_id, test]));
  return <Card className="overflow-hidden py-0 shadow-xs"><div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3"><Database className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Configured training data</h2><span className="text-xs text-muted-foreground">Every compliance rule and its examples</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Rule</th><th className="px-4 py-2.5 font-medium">Scope</th><th className="px-4 py-2.5 font-medium">Examples</th><th className="px-4 py-2.5 font-medium">Quality check</th></tr></thead><tbody className="divide-y divide-border/70">{rules.map((rule) => { const test = testByRule.get(rule.id); const exampleCount = Number(Boolean(rule.allowed_examples)) + Number(Boolean(rule.prohibited_examples)); return <tr key={rule.id}><td className="px-4 py-3"><p className="font-medium">{rule.rule_number} · {rule.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{rule.category}</p></td><td className="px-4 py-3 text-xs text-muted-foreground">{rule.evaluation_mode ?? "RULE"} · {rule.is_active ? "Active" : "Inactive"}</td><td className="px-4 py-3"><Badge variant="outline">{exampleCount} example{exampleCount === 1 ? "" : "s"}</Badge></td><td className="px-4 py-3">{!test?.testable ? <span className="text-xs text-muted-foreground">No self-test</span> : test.passed ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Passing</span> : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Needs review</span>}</td></tr>; })}</tbody></table></div></Card>;
}

export default function TrainingDataPage() {
  const rules = useQuery({ queryKey: ["training-data", "rules"], queryFn: () => complianceService.getRules() });
  const selfTests = useQuery({ queryKey: ["training-data", "self-tests"], queryFn: complianceService.selfTest });
  const aiUsage = useQuery({ queryKey: ["training-data", "ai-usage"], queryFn: () => submissionService.aiUsage() });
  const loading = rules.isLoading || selfTests.isLoading || aiUsage.isLoading;
  const refresh = () => { void rules.refetch(); void selfTests.refetch(); void aiUsage.refetch(); };

  return <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-6 animate-in fade-in duration-300"><DashboardHeader title="Training data & quality" subtitle="Review the rulebook examples that guide compliance checks, their automated validation, and the AI service capacity behind them." actions={<Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refresh} disabled={loading}><RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh</Button>} />{loading ? <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading training data...</Card> : <><QualitySummary rules={rules.data ?? []} tests={selfTests.data ?? []} /><AiCapacity usage={aiUsage.data} />{rules.isError || selfTests.isError ? <Card className="flex items-center gap-2 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" />Some quality data could not be loaded. Refresh to try again.</Card> : <RuleDataTable rules={rules.data ?? []} tests={selfTests.data ?? []} />}</>}</div>;
}
