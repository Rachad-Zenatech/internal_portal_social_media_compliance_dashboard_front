import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Database, FileCheck2, Landmark, Loader2, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { complianceService, type ComplianceRule, type RuleSelfTest } from "@/services/complianceService";
import { submissionService } from "@/services/submissionService";
import type { AiUsage } from "@/types/sentiment";
import RuleDataTable from "./RuleTrainingTable";

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

function FinanceCoverage({ rules }: { rules: ComplianceRule[] }) {
  const financePattern = /investment|investor|financial|revenue|profit|return|stock|share|market|disclosure|earnings|guidance/i;
  const financeRules = rules.filter((rule) => financePattern.test([rule.title, rule.category, rule.summary, ...rule.prohibited_terms, ...rule.required_disclaimers].join(" ")));
  const active = financeRules.filter((rule) => rule.is_active);
  const triggers = active.reduce((total, rule) => total + rule.prohibited_terms.length + rule.disclaimer_triggers.length, 0);
  const evidence = active.filter((rule) => rule.required_disclaimers.length > 0 || /evidence|substantiate|disclosure/i.test(`${rule.title} ${rule.summary}`)).length;
  const metrics = [
    { label: "Investor safeguards", value: active.length, detail: "Active rules covering financial communications", icon: ShieldCheck },
    { label: "Claim triggers", value: triggers, detail: "Return, price, revenue, and disclosure signals", icon: TrendingUp },
    { label: "Evidence controls", value: evidence, detail: "Rules that require support or a disclosure", icon: FileCheck2 },
  ];

  return <Card className="overflow-hidden py-0 shadow-xs"><div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3"><Landmark className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Finance-content coverage</h2><span className="text-xs text-muted-foreground">Investor claims, disclosure, and market-risk training signals</span></div><div className="grid gap-px bg-border/70 sm:grid-cols-3">{metrics.map(({ label, value, detail, icon: Icon }) => <div key={label} className="bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground"><span>Recommended evidence source for a finance claim: filing and XBRL data from the SEC’s EDGAR APIs.</span><a className="font-medium text-primary hover:underline" href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">View SEC EDGAR data</a></div></Card>;
}

export default function TrainingDataPage() {
  const rules = useQuery({ queryKey: ["training-data", "rules"], queryFn: () => complianceService.getRules() });
  const selfTests = useQuery({ queryKey: ["training-data", "self-tests"], queryFn: complianceService.selfTest });
  const aiUsage = useQuery({ queryKey: ["training-data", "ai-usage"], queryFn: () => submissionService.aiUsage() });
  const loading = rules.isLoading || selfTests.isLoading || aiUsage.isLoading;
  const refresh = () => { void rules.refetch(); void selfTests.refetch(); void aiUsage.refetch(); };

  return <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-6 animate-in fade-in duration-300"><DashboardHeader title="Training data & quality" subtitle="Review the rulebook examples that guide compliance checks, their automated validation, and the AI service capacity behind them." actions={<Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={refresh} disabled={loading}><RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh</Button>} />{loading ? <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading training data...</Card> : <><QualitySummary rules={rules.data ?? []} tests={selfTests.data ?? []} /><FinanceCoverage rules={rules.data ?? []} /><AiCapacity usage={aiUsage.data} />{rules.isError || selfTests.isError ? <Card className="flex items-center gap-2 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" />Some quality data could not be loaded. Refresh to try again.</Card> : <RuleDataTable rules={rules.data ?? []} tests={selfTests.data ?? []} />}</>}</div>;
}
