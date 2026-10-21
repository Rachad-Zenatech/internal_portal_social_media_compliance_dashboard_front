import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  BookOpen,
  RefreshCw,
  Scale,
  Info,
  XCircle,
  Check,
  Layers,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { PLATFORM_LABELS, type SocialPlatform } from '@/components/video/PlatformIcon';
import { useAuth } from '@/lib/AuthContext';
import { submissionService } from '@/services/submissionService';
import {
  complianceService,
  type ComplianceRule,
  type ComplianceRuleCreate,
  type ComplianceRuleUpdate,
  type ComplianceCheckResponse,
  type TrafficLight,
  type ComplianceSeverity,
} from '@/services/complianceService';

const CATEGORIES = [
  'All Categories',
  'Thought Leadership & Tone',
  'Product & Prototype Maturity',
  'Government & Customer Claims',
  'Defense Imagery & Video',
  'Personnel, Uniforms & Badges',
  'Military Seals & Insignia',
  'AI, Renders & Synthetic Media',
  'Security, Privacy & CUI',
  'Investor Disclosure & Procurement',
  'Endorsement & Disclaimers',
  'Governance & Workflow',
];

type ScopeKey = 'rule_sets' | 'brands' | 'audiences' | 'regions' | 'platforms';
type RuleScope = Record<ScopeKey, string[]>;
type ScopeOption = { value: string; label: string };

const EMPTY_SCOPE: RuleScope = { rule_sets: [], brands: [], audiences: [], regions: [], platforms: [] };

const TRAFFIC_LIGHT_TONE: Record<TrafficLight, { badge: string; solid: string }> = {
  RED: { badge: 'border-red-500/40 text-red-600 bg-red-500/10', solid: 'bg-red-600 text-white' },
  YELLOW: { badge: 'border-amber-500/40 text-amber-600 bg-amber-500/10', solid: 'bg-amber-600 text-white' },
  GREEN: { badge: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', solid: 'bg-emerald-600 text-white' },
};

/** Toggle chips for picking several values; nothing picked means "all". */
function ChipPicker({
  label,
  emptyHint,
  options,
  value,
  onChange,
}: {
  label: string;
  emptyHint: string;
  options: ScopeOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-semibold">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{value.length ? `${value.length} selected` : emptyHint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Next free "Rule N" number across every rule, not just the filtered list. */
function nextRuleNumber(rules: ComplianceRule[]) {
  const max = rules.reduce((m, r) => {
    const n = /^rule\s+(\d+)$/i.exec(r.rule_number.trim());
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `Rule ${max + 1}`;
}

export default function ComplianceRulesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('CONFIG_ROLES_UPDATE');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedTrafficLight, setSelectedTrafficLight] = useState<string>('ALL');
  const [selectedRuleSet, setSelectedRuleSet] = useState<string>('ALL');

  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ComplianceRule | null>(null);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Form State for Create / Edit
  const [formRuleNumber, setFormRuleNumber] = useState('');
  const [formCategory, setFormCategory] = useState('Product & Prototype Maturity');
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formSeverity, setFormSeverity] = useState<ComplianceSeverity>('HIGH');
  const [formTrafficLight, setFormTrafficLight] = useState<TrafficLight>('YELLOW');
  const [formProhibitedTerms, setFormProhibitedTerms] = useState('');
  const [formRequiredDisclaimers, setFormRequiredDisclaimers] = useState('');
  const [formAllowedExamples, setFormAllowedExamples] = useState('');
  const [formProhibitedExamples, setFormProhibitedExamples] = useState('');
  const [formRemediation, setFormRemediation] = useState('');
  const [formScope, setFormScope] = useState<RuleScope>(EMPTY_SCOPE);
  const [formActive, setFormActive] = useState(true);

  // AI Compliance Scanner State
  const [scannerText, setScannerText] = useState('');
  const [scannerTitle, setScannerTitle] = useState('');
  const [checkResult, setCheckResult] = useState<ComplianceCheckResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [scannerRuleSets, setScannerRuleSets] = useState<string[]>([]);

  // Queries
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['compliance-rules', selectedCategory, selectedTrafficLight, selectedRuleSet, search],
    queryFn: () =>
      complianceService.getRules({
        category: selectedCategory === 'All Categories' ? undefined : selectedCategory,
        traffic_light: selectedTrafficLight === 'ALL' ? undefined : selectedTrafficLight,
        rule_set: selectedRuleSet === 'ALL' ? undefined : selectedRuleSet,
        search: search.trim() || undefined,
      }),
  });

  // Rule sets, brands, audiences, regions and platforms come from the same list New Submission uses.
  const { data: options } = useQuery({
    queryKey: ['submission-options'],
    queryFn: submissionService.getOptions,
  });
  const scopeOptions = useMemo<Record<ScopeKey, ScopeOption[]>>(
    () => ({
      rule_sets: (options?.rule_sets ?? []).map((r) => ({ value: r, label: r })),
      brands: (options?.brands ?? []).map((b) => ({ value: b.code, label: b.name })),
      audiences: Object.entries(options?.audiences ?? {}).map(([value, label]) => ({ value, label })),
      // "Global" content is checked against every regional rule, so it isn't a rule scope.
      regions: (options?.regions ?? []).filter((r) => r !== 'Global').map((r) => ({ value: r, label: r })),
      platforms: (options?.platforms ?? []).map((p) => ({ value: p, label: PLATFORM_LABELS[p as SocialPlatform] ?? p })),
    }),
    [options]
  );
  const scopeLabel = (key: ScopeKey, value: string) => scopeOptions[key].find((o) => o.value === value)?.label ?? value;

  const { data: stats } = useQuery({
    queryKey: ['compliance-stats'],
    queryFn: complianceService.getStats,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ComplianceRuleCreate) => complianceService.createRule(data),
    onSuccess: (rule) => {
      toast.success(`Compliance rule ${rule.rule_number} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Failed to create rule: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ComplianceRuleUpdate }) =>
      complianceService.updateRule(id, data),
    onSuccess: (rule) => {
      toast.success(`Compliance rule ${rule.rule_number} updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
      setEditingRule(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Failed to update rule: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => complianceService.deleteRule(id),
    onSuccess: () => {
      toast.success('Compliance rule removed successfully.');
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
      setDeletingRule(null);
    },
    onError: (err: any) => {
      toast.error('Failed to remove rule: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const resetDefaultsMutation = useMutation({
    mutationFn: complianceService.resetDefaults,
    onSuccess: () => {
      toast.success('Baseline rules restored from the Defense Rulebook.');
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-stats'] });
      setIsResetConfirmOpen(false);
    },
    onError: (err: any) => {
      toast.error('Failed to re-sync the rulebook: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const handleOpenAdd = async () => {
    resetForm();
    // When a rule set is filtered, a new rule most likely belongs to it.
    if (selectedRuleSet !== 'ALL') setFormScope({ ...EMPTY_SCOPE, rule_sets: [selectedRuleSet] });
    setIsAddOpen(true);
    try {
      setFormRuleNumber(nextRuleNumber(await complianceService.getRules()));
    } catch {
      setFormRuleNumber('');
    }
  };

  const handleOpenEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setFormRuleNumber(rule.rule_number);
    setFormCategory(rule.category);
    setFormTitle(rule.title);
    setFormSummary(rule.summary);
    setFormSeverity(rule.severity);
    setFormTrafficLight(rule.traffic_light);
    setFormProhibitedTerms(rule.prohibited_terms.join(', '));
    setFormRequiredDisclaimers(rule.required_disclaimers.join('\n'));
    setFormAllowedExamples(rule.allowed_examples || '');
    setFormProhibitedExamples(rule.prohibited_examples || '');
    setFormRemediation(rule.remediation_guidance || '');
    setFormScope({
      rule_sets: rule.rule_sets ?? [],
      brands: rule.brands ?? [],
      audiences: rule.audiences ?? [],
      regions: rule.regions ?? [],
      platforms: rule.platforms ?? [],
    });
    setFormActive(rule.is_active);
  };

  const resetForm = () => {
    setFormRuleNumber('');
    setFormCategory('Product & Prototype Maturity');
    setFormTitle('');
    setFormSummary('');
    setFormSeverity('HIGH');
    setFormTrafficLight('YELLOW');
    setFormProhibitedTerms('');
    setFormRequiredDisclaimers('');
    setFormAllowedExamples('');
    setFormProhibitedExamples('');
    setFormRemediation('');
    setFormScope(EMPTY_SCOPE);
    setFormActive(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRuleNumber.trim() || !formTitle.trim() || !formSummary.trim()) {
      toast.error('Rule Number, Title, and Summary are required.');
      return;
    }

    const prohibitedArray = formProhibitedTerms
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const disclaimersArray = formRequiredDisclaimers
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    if (editingRule) {
      updateMutation.mutate({
        id: editingRule.id,
        data: {
          rule_number: formRuleNumber.trim(),
          category: formCategory,
          title: formTitle.trim(),
          summary: formSummary.trim(),
          severity: formSeverity,
          traffic_light: formTrafficLight,
          prohibited_terms: prohibitedArray,
          required_disclaimers: disclaimersArray,
          // Empty strings (not undefined) so clearing a field actually clears it.
          allowed_examples: formAllowedExamples.trim(),
          prohibited_examples: formProhibitedExamples.trim(),
          remediation_guidance: formRemediation.trim(),
          ...formScope,
          is_active: formActive,
        },
      });
    } else {
      createMutation.mutate({
        rule_number: formRuleNumber.trim(),
        category: formCategory,
        title: formTitle.trim(),
        summary: formSummary.trim(),
        severity: formSeverity,
        traffic_light: formTrafficLight,
        prohibited_terms: prohibitedArray,
        required_disclaimers: disclaimersArray,
        allowed_examples: formAllowedExamples.trim() || undefined,
        prohibited_examples: formProhibitedExamples.trim() || undefined,
        remediation_guidance: formRemediation.trim() || undefined,
        ...formScope,
        is_active: formActive,
      });
    }
  };

  const handleRunScanner = async () => {
    if (!scannerText.trim()) {
      toast.error('Please enter a draft video caption, transcript, or claim to test.');
      return;
    }
    setIsChecking(true);
    try {
      const res = await complianceService.checkCompliance({
        text: scannerText,
        video_title: scannerTitle.trim() || undefined,
        rule_sets: scannerRuleSets,
      });
      setCheckResult(res);
      if (res.is_compliant) {
        toast.success('Clean! No rule violations detected.');
      } else if (res.traffic_light === 'RED') {
        toast.error(`Stop! ${res.violations_count} critical red-line violation(s) flagged.`);
      } else {
        toast.warning(`Review required: ${res.violations_count} claim(s) require clearance.`);
      }
    } catch (err: any) {
      toast.error('Compliance scan failed: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <DashboardHeader
        title="Compliance Rulebook"
        subtitle="The rules content is screened against, grouped into rule sets. A submission is only checked against the rules that match its rule sets, brand, audience, region and platforms."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQuickGuideOpen(true)}
              className="gap-1.5 text-xs font-medium"
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Creator Quick-Use Guide
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetConfirmOpen(true)}
                disabled={resetDefaultsMutation.isPending}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="Restore baseline rules from the Defense Rulebook"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resetDefaultsMutation.isPending ? 'animate-spin' : ''}`} />
                Re-sync Rulebook
              </Button>
            )}
            {canManage && (
              <Button onClick={handleOpenAdd} size="sm" className="gap-1.5 text-xs font-semibold shadow-xs">
                <Plus className="w-4 h-4" />
                Build Rule
              </Button>
            )}
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium">Active Rules</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center justify-between">
              <span>{stats?.active_rules ?? rules.length}</span>
              <Scale className="w-5 h-5 text-primary/70" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Used in automated screening
              {stats && stats.total_rules > stats.active_rules && ` · ${stats.total_rules - stats.active_rules} turned off`}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium text-red-600 dark:text-red-400">
              Red-Line Critical Rules
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400 flex items-center justify-between">
              <span>{stats?.critical_red_rules ?? 0}</span>
              <XCircle className="w-5 h-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-red-700/80 dark:text-red-300/80">Absolute prohibitions requiring Legal/IR hold</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium text-amber-600 dark:text-amber-400">
              Yellow Review Rules
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>{stats?.yellow_review_rules ?? 0}</span>
              <AlertTriangle className="w-5 h-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">Requires Product/Engineering or Comms sign-off</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium text-emerald-600 dark:text-emerald-400">
              Standard Thought Leadership
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <span>{stats?.green_standard_rules ?? 0}</span>
              <CheckCircle2 className="w-5 h-5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">Approved pillars, voice, and concept lanes</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tab View: Rules Management vs Interactive Scanner */}
      <Tabs defaultValue="rules" className="w-full space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="rules" className="gap-2 text-xs font-medium">
            <FileText className="w-3.5 h-3.5" />
            <span className="sm:hidden">Rules ({rules.length})</span>
            <span className="hidden sm:inline">Manage Compliance Rules ({rules.length})</span>
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-2 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="sm:hidden">Claim Scanner</span>
            <span className="hidden sm:inline">Interactive Script & Claim Scanner</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Rules Management */}
        <TabsContent value="rules" className="space-y-4">
          {/* Rule set filter */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Rule sets">
            <Layers className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
            {['ALL', ...(options?.rule_sets ?? [])].map((rs) => (
              <button
                key={rs}
                type="button"
                role="tab"
                aria-selected={selectedRuleSet === rs}
                onClick={() => setSelectedRuleSet(rs)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selectedRuleSet === rs ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {rs === 'ALL' ? 'All rule sets' : rs}
                {rs !== 'ALL' && stats?.rule_sets && (
                  <span className={`ml-1.5 font-normal ${selectedRuleSet === rs ? 'opacity-70' : ''}`}>{stats.rule_sets[rs] ?? 0}</span>
                )}
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          <Card className="shadow-xs border-border/80">
            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rules, keywords, triggers, or policies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full md:w-[220px] text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTrafficLight} onValueChange={setSelectedTrafficLight}>
                  <SelectTrigger className="w-full md:w-[150px] text-xs">
                    <SelectValue placeholder="Traffic Light" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">All Risk Tiers</SelectItem>
                    <SelectItem value="RED" className="text-xs text-red-600 font-medium">Red (Critical)</SelectItem>
                    <SelectItem value="YELLOW" className="text-xs text-amber-600 font-medium">Yellow (Review)</SelectItem>
                    <SelectItem value="GREEN" className="text-xs text-emerald-600 font-medium">Green (Approved)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Rules List / Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="p-6 space-y-4">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </Card>
              ))}
            </div>
          ) : rules.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <Scale className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">No compliance rules matched your filters</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Try adjusting your search criteria, category selection, or add a custom rule.
                </p>
                {canManage && (
                  <Button onClick={handleOpenAdd} size="sm" variant="outline" className="gap-1.5 text-xs mt-2">
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Rule
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => {
                const tone = TRAFFIC_LIGHT_TONE[rule.traffic_light] ?? TRAFFIC_LIGHT_TONE.YELLOW;
                const limits: string[] = [
                  ...rule.brands.map((v) => scopeLabel('brands', v)),
                  ...rule.audiences.map((v) => scopeLabel('audiences', v)),
                  ...rule.regions.map((v) => scopeLabel('regions', v)),
                  ...rule.platforms.map((v) => scopeLabel('platforms', v)),
                ];

                return (
                  <Card
                    key={rule.id}
                    className={`flex flex-col justify-between shadow-xs border-border/80 hover:border-primary/40 transition-colors ${
                      rule.is_active ? '' : 'opacity-60'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider font-semibold ${tone.badge}`}
                            >
                              {rule.rule_number}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] font-normal text-muted-foreground">
                              {rule.category}
                            </Badge>
                            {rule.is_custom && (
                              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                                Custom
                              </Badge>
                            )}
                            {!rule.is_active && (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                Turned off
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-base font-semibold text-foreground pt-1">{rule.title}</CardTitle>
                        </div>
                        <Badge className={`text-[10px] font-bold uppercase ${tone.solid}`}>{rule.traffic_light}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pb-3 text-xs text-muted-foreground">
                      <p className="line-clamp-3 leading-relaxed text-foreground/90">{rule.summary}</p>

                      <div className="flex flex-wrap items-center gap-1">
                        {rule.rule_sets.length ? (
                          rule.rule_sets.map((rs) => (
                            <span key={rs} className="inline-flex items-center gap-1 rounded-sm border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Layers className="w-3 h-3" />
                              {rs}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">All rule sets</span>
                        )}
                        {limits.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">· Only {limits.join(', ')}</span>
                        )}
                      </div>

                      {rule.prohibited_terms && rule.prohibited_terms.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                            Prohibited Trigger Phrases:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {rule.prohibited_terms.slice(0, 5).map((term, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-sm bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-mono border border-red-500/20"
                              >
                                {term}
                              </span>
                            ))}
                            {rule.prohibited_terms.length > 5 && (
                              <span className="text-[10px] text-muted-foreground self-center">
                                +{rule.prohibited_terms.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {rule.required_disclaimers && rule.required_disclaimers.length > 0 && (
                        <div className="p-2 rounded bg-muted/30 border border-border/60 text-[11px] italic text-muted-foreground">
                          <strong>Required Label:</strong> "{rule.required_disclaimers[0]}"
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-border/40 bg-muted/5 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-muted-foreground">
                        Severity: <strong className="uppercase">{rule.severity}</strong>
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(rule)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingRule(rule)}
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Interactive AI Compliance Scanner */}
        <TabsContent value="scanner" className="space-y-6">
          <Card className="shadow-xs border-border/80">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Rulebook Claim Scanner
              </div>
              <CardDescription className="text-xs">
                Test a script, caption or claim against the trigger phrases of the active rules. Pick rule sets to check
                only the rules a post would actually be held to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="scan-title" className="text-xs">
                  Video / Asset Title (Optional)
                </Label>
                <Input
                  id="scan-title"
                  placeholder="e.g. ZenaDrone 1000 Autonomous Logistics Demonstration"
                  value={scannerTitle}
                  onChange={(e) => setScannerTitle(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="scan-text" className="text-xs font-semibold">
                  Script, Caption, or Marketing Claims to Test *
                </Label>
                <Textarea
                  id="scan-text"
                  rows={6}
                  placeholder="Paste video narration, social post caption, press snippet, or visual concept description here..."
                  value={scannerText}
                  onChange={(e) => setScannerText(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <ChipPicker
                label="Check against rule sets"
                emptyHint="All rule sets"
                options={scopeOptions.rule_sets}
                value={scannerRuleSets}
                onChange={setScannerRuleSets}
              />

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScannerText(
                      'ZenaDrone has partnered with the U.S. Army to deliver combat-proven autonomous swarm logistics. Pentagon procurement is failing our warfighters, but our fielded drone system is already adopted by military commanders.'
                    );
                  }}
                  className="text-xs"
                >
                  Load High-Risk Sample
                </Button>
                <Button
                  size="sm"
                  onClick={handleRunScanner}
                  disabled={isChecking}
                  className="gap-2 text-xs font-semibold px-4"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  {isChecking ? 'Scanning Content...' : 'Run Compliance Scan'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scanner Results Display */}
          {checkResult && (
            <Card
              className={`shadow-xs border ${
                checkResult.traffic_light === 'RED'
                  ? 'border-red-500/40 bg-red-500/5'
                  : checkResult.traffic_light === 'YELLOW'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-emerald-500/40 bg-emerald-500/5'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-xs ${
                        checkResult.traffic_light === 'RED'
                          ? 'bg-red-600'
                          : checkResult.traffic_light === 'YELLOW'
                          ? 'bg-amber-600'
                          : 'bg-emerald-600'
                      }`}
                    >
                      {checkResult.traffic_light === 'RED' ? (
                        <XCircle className="w-6 h-6" />
                      ) : checkResult.traffic_light === 'YELLOW' ? (
                        <AlertTriangle className="w-6 h-6" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">
                        {checkResult.is_compliant
                          ? '100% Compliant — Ready for Review'
                          : `${checkResult.violations_count} Rule Violation(s) Flagged — Risk Tier: ${checkResult.traffic_light}`}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Compliance Health Score: <strong>{checkResult.score} / 100</strong>
                        {checkResult.rules_checked != null && ` · Checked against ${checkResult.rules_checked} rule${checkResult.rules_checked === 1 ? '' : 's'}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    className={`text-xs px-3 py-1 font-bold uppercase ${
                      checkResult.traffic_light === 'RED'
                        ? 'bg-red-600 text-white'
                        : checkResult.traffic_light === 'YELLOW'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    Traffic Light: {checkResult.traffic_light}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {checkResult.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-background/80 border border-border/80 text-xs font-semibold flex items-center gap-2"
                  >
                    <Info className="w-4 h-4 text-primary shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}

                {checkResult.violations.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Violations & Actionable Remediation:
                    </span>
                    <div className="space-y-2">
                      {checkResult.violations.map((v, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg bg-card border border-border space-y-2 text-xs shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {v.rule_number}
                              </Badge>
                              {v.title}
                            </span>
                            <Badge
                              className={`text-[9px] uppercase font-bold ${
                                v.traffic_light === 'RED' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
                              }`}
                            >
                              {v.severity}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{v.explanation}</p>
                          {v.remediation_guidance && (
                            <div className="p-2.5 rounded bg-muted/40 border border-border/60 text-[11px] text-foreground/90 space-y-1">
                              <strong className="text-primary flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> How to fix:
                              </strong>
                              <p>{v.remediation_guidance}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* CREATE / EDIT DIALOG ("build on it") */}
      <Dialog
        open={isAddOpen || Boolean(editingRule)}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingRule(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="w-full sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingRule ? `Edit Compliance Rule: ${editingRule.rule_number}` : 'Build New Compliance Rule'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define the standard, its trigger phrases and review guidance, and which content it applies to.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rule-num" className="text-xs font-semibold">
                  Rule Number / Code *
                </Label>
                <Input
                  id="rule-num"
                  placeholder="e.g. Rule 16, Section 28"
                  value={formRuleNumber}
                  onChange={(e) => setFormRuleNumber(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs font-semibold">
                  Category *
                </Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="category" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">
                Rule Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g. Mandatory Non-Endorsement Disclaimer on Flight Test Videos"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="traffic-light" className="text-xs font-semibold">
                  Traffic Light Rating *
                </Label>
                <Select value={formTrafficLight} onValueChange={(v: TrafficLight) => setFormTrafficLight(v)}>
                  <SelectTrigger id="traffic-light" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RED" className="text-xs font-bold text-red-600">
                      RED (Stop / Critical Prohibited)
                    </SelectItem>
                    <SelectItem value="YELLOW" className="text-xs font-bold text-amber-600">
                      YELLOW (Hold for Second Review)
                    </SelectItem>
                    <SelectItem value="GREEN" className="text-xs font-bold text-emerald-600">
                      GREEN (Standard Clearance)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="severity" className="text-xs font-semibold">
                  Severity Tier *
                </Label>
                <Select value={formSeverity} onValueChange={(v: ComplianceSeverity) => setFormSeverity(v)}>
                  <SelectTrigger id="severity" className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRITICAL" className="text-xs font-bold text-red-600">CRITICAL</SelectItem>
                    <SelectItem value="HIGH" className="text-xs font-bold text-amber-600">HIGH</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs font-bold text-blue-600">MEDIUM</SelectItem>
                    <SelectItem value="LOW" className="text-xs font-bold text-slate-600">LOW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="summary" className="text-xs font-semibold">
                Summary & Operating Rule *
              </Label>
              <Textarea
                id="summary"
                rows={3}
                placeholder="Describe the governance rule, background constraint, and compliance expectation..."
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prohibited-terms" className="text-xs font-semibold">
                Prohibited Trigger Phrases (Comma-separated)
              </Label>
              <Input
                id="prohibited-terms"
                placeholder="e.g. partnered with army, fielded system, combat proven, dod certified"
                value={formProhibitedTerms}
                onChange={(e) => setFormProhibitedTerms(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                The scanner flags content containing any of these phrases. Case, hyphens and punctuation are ignored.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disclaimers" className="text-xs font-semibold">
                Required Disclaimers / Concept Labels (One per line)
              </Label>
              <Textarea
                id="disclaimers"
                rows={2}
                placeholder="e.g. Conceptual visualization - depicts a potential future use, not an actual military operation."
                value={formRequiredDisclaimers}
                onChange={(e) => setFormRequiredDisclaimers(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="allowed" className="text-xs font-semibold text-emerald-600">
                  Approved / Permitted Examples
                </Label>
                <Textarea
                  id="allowed"
                  rows={2}
                  placeholder="Examples of compliant phrasing..."
                  value={formAllowedExamples}
                  onChange={(e) => setFormAllowedExamples(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prohibited" className="text-xs font-semibold text-red-600">
                  Prohibited Examples
                </Label>
                <Textarea
                  id="prohibited"
                  rows={2}
                  placeholder="Examples of dangerous phrasing..."
                  value={formProhibitedExamples}
                  onChange={(e) => setFormProhibitedExamples(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remediation" className="text-xs font-semibold">
                Remediation & Review Guidance
              </Label>
              <Textarea
                id="remediation"
                rows={2}
                placeholder="Actionable steps for editors/reviewers to resolve violations..."
                value={formRemediation}
                onChange={(e) => setFormRemediation(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="rounded-lg border border-border/80 p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-foreground">Applies to</p>
                <p className="text-[11px] text-muted-foreground">
                  Leave a group empty to apply the rule to everything in it. A submission is checked against this rule only
                  when it matches every group that has a selection.
                </p>
              </div>
              <ChipPicker
                label="Rule sets"
                emptyHint="All rule sets"
                options={scopeOptions.rule_sets}
                value={formScope.rule_sets}
                onChange={(v) => setFormScope((s) => ({ ...s, rule_sets: v }))}
              />
              <ChipPicker
                label="Brands"
                emptyHint="All brands"
                options={scopeOptions.brands}
                value={formScope.brands}
                onChange={(v) => setFormScope((s) => ({ ...s, brands: v }))}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChipPicker
                  label="Audiences"
                  emptyHint="All audiences"
                  options={scopeOptions.audiences}
                  value={formScope.audiences}
                  onChange={(v) => setFormScope((s) => ({ ...s, audiences: v }))}
                />
                <ChipPicker
                  label="Regions"
                  emptyHint="All regions"
                  options={scopeOptions.regions}
                  value={formScope.regions}
                  onChange={(v) => setFormScope((s) => ({ ...s, regions: v }))}
                />
              </div>
              <ChipPicker
                label="Platforms"
                emptyHint="All platforms"
                options={scopeOptions.platforms}
                value={formScope.platforms}
                onChange={(v) => setFormScope((s) => ({ ...s, platforms: v }))}
              />
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-border/80 p-3 cursor-pointer">
              <Checkbox checked={formActive} onCheckedChange={(v) => setFormActive(v === true)} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-xs font-semibold text-foreground">Active</span>
                <span className="block text-[11px] text-muted-foreground">
                  Turned-off rules stay in the rulebook but aren't used in screening.
                </span>
              </span>
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingRule(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="gap-1.5 text-xs font-semibold"
              >
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG ("and remove") */}
      <AlertDialog
        open={Boolean(deletingRule)}
        onOpenChange={(open) => {
          if (!open) setDeletingRule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Remove Compliance Rule?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                Are you sure you want to remove <strong>{deletingRule?.rule_number}: {deletingRule?.title}</strong>?
              </p>
              <p className="text-muted-foreground">
                It's removed from screening right away. To keep it but stop using it, edit the rule and turn it off
                instead. Removed baseline rules come back with "Re-sync Rulebook".
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRule && deleteMutation.mutate(deletingRule.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            >
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* RE-SYNC CONFIRMATION */}
      <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Re-sync baseline rules?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                The baseline rules go back to the Defense Rulebook's wording, rule sets and scope, and any that were
                removed or turned off are restored.
              </p>
              <p className="text-muted-foreground">Edits made to baseline rules will be lost. Custom rules are not changed.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                resetDefaultsMutation.mutate();
              }}
              disabled={resetDefaultsMutation.isPending}
              className="text-xs font-semibold"
            >
              {resetDefaultsMutation.isPending ? 'Re-syncing...' : 'Re-sync Rulebook'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QUICK GUIDE MODAL */}
      <Dialog open={isQuickGuideOpen} onOpenChange={setIsQuickGuideOpen}>
        <DialogContent className="w-full sm:max-w-3xl lg:max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Creator Quick-Use Guide: Defense Content & Social Media
            </DialogTitle>
            <DialogDescription className="text-xs">
              Everyday working rules created by Communications, IR, Marketing, and Legal/Compliance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 text-xs text-foreground/90 pt-2">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
              <span className="font-bold text-primary text-xs uppercase tracking-wider">The Golden Rule:</span>
              <p className="font-medium text-xs leading-relaxed">
                Be bold about the defense problem and future vision. Be exact about what ZenaDrone / ZenaTech has built,
                tested, proven, sold, or done with a government customer.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm">Eight Rules Everyone Must Follow:</h3>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                <li><strong>Challenge the problem</strong> — never insult the customer or military leadership.</li>
                <li><strong>Do not make a prototype</strong> look deployed, operational, or commercially adopted.</li>
                <li><strong>Never upgrade a meeting</strong>, test, pilot, or evaluation into a partnership or sale.</li>
                <li><strong>Do not imply endorsement</strong> by a U.S. defense agency, Military Service, unit, or official.</li>
                <li><strong>The image cannot claim</strong> more than the words are allowed to claim.</li>
                <li><strong>Do not post new contract</strong>, pipeline, revenue, test-result, or customer information.</li>
                <li><strong>Do not reveal sensitive locations</strong>, screens, documents, tactics, or technical details.</li>
                <li><strong>If you are uncertain</strong>, stop and ask Comms/IR before publishing.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm">The Traffic-Light Imagery System:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">GREEN (Standard)</span>
                  <p className="text-[11px] text-muted-foreground">
                    Generic defense scenes, abstract radar/sensor displays, operator from behind, standalone product photos.
                  </p>
                </div>
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <span className="font-bold text-amber-700 dark:text-amber-400">YELLOW (Review)</span>
                  <p className="text-[11px] text-muted-foreground">
                    Real base or service member, uniform text/patches, DVIDS imagery, actual test footage, photorealistic renders.
                  </p>
                </div>
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 space-y-1">
                  <span className="font-bold text-red-700 dark:text-red-400">RED (Hold / Prohibited)</span>
                  <p className="text-[11px] text-muted-foreground">
                    Military seals or branch logos beside ZenaDrone, recognizable officer endorsing product, fake combat kills.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-sm">The 10-Question Pre-Publication Checklist:</h3>
              <p className="text-muted-foreground text-[11px]">
                A "YES" or "UNSURE" on questions 1-9 means <strong>STOP AND REVIEW</strong> before publishing.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-muted/40 border">1. Criticizes or ridicules the agency or military?</div>
                <div className="p-2 rounded bg-muted/40 border">2. Makes prototype look sold, deployed, or adopted?</div>
                <div className="p-2 rounded bg-muted/40 border">3. Turns a meeting/test into partnership/sale?</div>
                <div className="p-2 rounded bg-muted/40 border">4. Implies government, Service, or unit endorsement?</div>
                <div className="p-2 rounded bg-muted/40 border">5. Reveals non-public contract, revenue, or pipeline?</div>
                <div className="p-2 rounded bg-muted/40 border">6. Mentions active bid, competitor standing, or shortlist?</div>
                <div className="p-2 rounded bg-muted/40 border">7. Reveals sensitive, CUI, or vulnerability data?</div>
                <div className="p-2 rounded bg-muted/40 border">8. Commercial rights and releases secured for all media?</div>
                <div className="p-2 rounded bg-muted/40 border">9. Written evidence supports every single claim made?</div>
                <div className="p-2 rounded bg-muted/40 border font-semibold text-primary">10. Would you show it to a Contracting Officer and Investor?</div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button size="sm" onClick={() => setIsQuickGuideOpen(false)}>
              Close Guide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
