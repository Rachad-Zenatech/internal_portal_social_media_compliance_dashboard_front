import { apiClient } from '@/services/apiClient';
import type { RuleFlagStats } from '@/types/submission';

export type ComplianceSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TrafficLight = 'RED' | 'YELLOW' | 'GREEN';

export interface ComplianceRule {
  id: string;
  rulebook_id?: string | null;
  rule_number: string;
  category: string;
  title: string;
  summary: string;
  severity: ComplianceSeverity;
  traffic_light: TrafficLight;
  prohibited_terms: string[];
  required_disclaimers: string[];
  /** Phrases that make the disclaimer necessary; empty means it's needed on everything the rule covers. */
  disclaimer_triggers: string[];
  /** Phrases that cancel a match inside them, e.g. "not combat proven". */
  exception_terms?: string[];
  allowed_examples?: string | null;
  prohibited_examples?: string | null;
  remediation_guidance?: string | null;
  applies_to: string[];
  /** Scope: an empty list means the rule applies to every value. */
  rule_sets: string[];
  brands: string[];
  audiences: string[];
  regions: string[];
  platforms: string[];
  is_active: boolean;
  is_custom: boolean;
  sort_order: number;
  /** How a match is judged (see EvaluationMode), and what the judge must decide for a CONTEXT rule. */
  evaluation_mode?: EvaluationMode;
  evaluation_guidance?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ComplianceRuleCreate {
  rule_number: string;
  category: string;
  title: string;
  summary: string;
  severity: ComplianceSeverity;
  traffic_light: TrafficLight;
  prohibited_terms: string[];
  required_disclaimers: string[];
  disclaimer_triggers?: string[];
  exception_terms?: string[];
  allowed_examples?: string;
  prohibited_examples?: string;
  remediation_guidance?: string;
  applies_to?: string[];
  rule_sets?: string[];
  brands?: string[];
  audiences?: string[];
  regions?: string[];
  platforms?: string[];
  is_active?: boolean;
  sort_order?: number;
  evaluation_mode?: EvaluationMode;
  evaluation_guidance?: string;
}

/** RULE: a match is a finding. CONTEXT: a match is a candidate the AI judges from its sentence. */
export type EvaluationMode = 'RULE' | 'CONTEXT';

export interface ComplianceRuleUpdate {
  rule_number?: string;
  category?: string;
  title?: string;
  summary?: string;
  severity?: ComplianceSeverity;
  traffic_light?: TrafficLight;
  prohibited_terms?: string[];
  required_disclaimers?: string[];
  disclaimer_triggers?: string[];
  exception_terms?: string[];
  allowed_examples?: string;
  prohibited_examples?: string;
  remediation_guidance?: string;
  applies_to?: string[];
  rule_sets?: string[];
  brands?: string[];
  audiences?: string[];
  regions?: string[];
  platforms?: string[];
  is_active?: boolean;
  sort_order?: number;
  evaluation_mode?: EvaluationMode;
  evaluation_guidance?: string;
}

export interface ComplianceViolation {
  rule_id: string;
  rule_number: string;
  title: string;
  category: string;
  severity: string;
  traffic_light: TrafficLight;
  flagged_terms: string[];
  explanation: string;
  remediation_guidance?: string | null;
  /** PROHIBITED_TERM: forbidden wording. MISSING_DISCLAIMER: wording that needs a disclaimer, without it. */
  kind?: 'PROHIBITED_TERM' | 'MISSING_DISCLAIMER';
  /** Any one of these satisfies the rule. */
  missing_disclaimers?: string[];
  /** Points this finding took off the score (missing on checks saved before penalties were recorded). */
  penalty?: number;
  /** Set when its words were already counted for a stricter rule; it then costs 0. */
  counted_with?: string | null;
  /** Separate claims beyond the first that the penalty also covers. */
  extra_claims?: number;
  /** What it amounts to once read in context (missing on checks saved before statuses: a violation). */
  status?: FindingStatus;
  /** How the AI read it in context (rules judged in context only). */
  evaluation?: ContextEvaluation | null;
  /** The sentence the wording sits in, and the lines around it. */
  passage?: string | null;
  context?: string | null;
}

/**
 * VIOLATION breaks a rule (costs points; a critical one blocks). NEEDS_REVIEW depends on something the text can't show,
 * such as the final footage. EVIDENCE_REQUIRED is a claim that needs a source. CLEARED is a trigger the context shows
 * isn't a breach. Only violations cost points or block; the rest are warnings.
 */
export type FindingStatus = 'VIOLATION' | 'NEEDS_REVIEW' | 'EVIDENCE_REQUIRED' | 'CLEARED';

export interface ContextEvaluation {
  decision: FindingStatus;
  matched_text?: string | null;
  /** Who or what the statement is about. */
  subject?: string | null;
  reasoning: string;
  confidence: number;
  recommended_action?: string | null;
  /** What the rule match alone would have said. */
  rule_decision: FindingStatus;
  /** AI judged it; ADJUSTED means a safeguard changed the answer; UNAVAILABLE means no model could judge it. */
  source: 'AI' | 'ADJUSTED' | 'UNAVAILABLE';
  model?: string | null;
}

export interface ComplianceCheckResponse {
  is_compliant: boolean;
  traffic_light: TrafficLight;
  score: number;
  /** A critical finding blocks publication; the score is capped so it can't look like a pass. */
  blocked?: boolean;
  score_cap?: number | null;
  /** 100 minus every penalty, before the cap. */
  raw_score?: number;
  /** The rulebook as of this check. */
  rulebook_version?: string | null;
  /** Findings that are violations: what costs points and counts as "to fix". */
  violations_count: number;
  /** Warnings that cost nothing and don't block (missing on older checks). */
  review_count?: number;
  evidence_count?: number;
  cleared_count?: number;
  /** Every finding, whatever its status. */
  violations: ComplianceViolation[];
  recommendations: string[];
  /** How many active rules applied to the content's scope (missing on checks saved before scoping). */
  rules_checked?: number;
  /** Of those, the rules the text check can't test (nothing to look for in text): a reviewer confirms them. */
  manual_review_rules?: ManualReviewRule[];
  /** Cashtags, hashtags, @mentions and links read from the post (missing on checks saved before they were read). */
  signals?: CheckSignals | null;
  /** Audiences the rules were picked for: the target plus any implied (empty when none is set: all audiences). */
  audiences_checked?: string[];
  /** What the content is made of, matched against each rule's applies_to (empty when not known). */
  content_parts?: string[];
  /** Rule sets the post's wording brought in on top of the chosen ones, and the wording that did it. */
  added_rule_sets?: { rule_set: string; because: string[] }[];
  /** The sources the post cites (links, "Source:" lines, attached documents) and what each showed about its claims. */
  source_checks?: SourceCheck[];
}

/**
 * SUPPORTED: the source says it. CONTRADICTED: it says something different, or less (costs points). NOT_FOUND: it covers
 * the subject but not this. UNCLEAR: could be read either way, so a person decides.
 */
export type SourceVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'NOT_FOUND' | 'UNCLEAR';

export interface SourceClaim {
  /** The claim as the post states it. */
  claim: string;
  verdict: SourceVerdict;
  where: 'caption' | 'image';
  /** What the source says about it (not always word for word). */
  evidence?: string | null;
  /** What to change or check, when the verdict isn't SUPPORTED. */
  note?: string | null;
  confidence: number;
}

export interface SourceCheck {
  /** The link, the cited document's name, or the attached file's name. */
  reference: string;
  kind: 'URL' | 'NAMED' | 'DOCUMENT';
  where: 'caption' | 'image' | 'attached';
  /** The words that marked it as a citation ("Source:", "Read the full article"). */
  cue?: string | null;
  /** READ: opened and checked. UNREADABLE: couldn't be opened or read. NOT_PROVIDED: cited by name only. */
  status: 'READ' | 'UNREADABLE' | 'NOT_PROVIDED';
  title?: string | null;
  url?: string | null;
  published?: string | null;
  authority?: 'OFFICIAL' | 'COMPANY' | 'NEWS' | 'OTHER' | null;
  message?: string | null;
  claims: SourceClaim[];
  model?: string | null;
}

/** What the check read from the post's symbols, before its wording was matched against the rules. */
export interface CheckSignals {
  cashtags: string[];
  hashtags: string[];
  mentions: string[];
  /** Domains linked to, e.g. "army.mil". */
  links: string[];
  /** The mentions and domains above that belong to a government or military. */
  government_references: string[];
  /** Audiences the post reaches whatever it targets, e.g. INVESTORS for a cashtag (missing on older checks). */
  implied_audiences?: string[];
  /** Worth a look but not a rule breach, so no points off (outside links, too many hashtags). */
  notes: string[];
}

/** An applicable rule the automated check can't test from text (e.g. image editing, image rights). */
export interface ManualReviewRule {
  rule_id: string;
  rule_number: string;
  title: string;
  severity: string;
}

/** One rule run against its own examples: "not acceptable" ones should be flagged, "acceptable" ones not. */
export interface RuleExampleResult {
  example: string;
  expected: 'FLAG' | 'CLEAR';
  flagged: boolean;
  matched_terms: string[];
  ok: boolean;
  /** Unquoted example text may describe imagery rather than give wording. */
  quoted: boolean;
}

export interface RuleSelfTest {
  rule_id: string;
  rule_number: string;
  title: string;
  /** False when the rule has no phrases, or no example wording to test. */
  testable: boolean;
  passed: boolean;
  results: RuleExampleResult[];
}

/** Who and where the content is for; only rules whose scope matches are run. */
export interface ComplianceCheckRequest {
  text: string;
  video_title?: string;
  content_type?: string;
  rule_sets?: string[];
  brand_code?: string;
  audience?: string;
  region?: string;
  platforms?: string[];
}

export interface ComplianceStats {
  total_rules: number;
  active_rules: number;
  critical_red_rules: number;
  yellow_review_rules: number;
  green_standard_rules: number;
  categories_count: number;
  categories: Record<string, number>;
  /** Active rules per rule set (rules with no rule set count toward every set). */
  rule_sets: Record<string, number>;
}

export interface VideoJobStage {
  id: string;
  label: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

export interface VideoJob {
  job_id: string;
  filename: string;
  video_title: string;
  platform: string;
  aspect_ratio: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress_percent: number;
  current_stage_index: number;
  current_stage: string;
  current_stage_label: string;
  stages: VideoJobStage[];
  logs: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  result?: any;
}

export const complianceService = {
  getRules: (params?: { category?: string; severity?: string; traffic_light?: string; is_active?: boolean; search?: string; rule_set?: string }) => {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.severity) q.append('severity', params.severity);
    if (params?.traffic_light) q.append('traffic_light', params.traffic_light);
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
    if (params?.search) q.append('search', params.search);
    if (params?.rule_set) q.append('rule_set', params.rule_set);
    const qs = q.toString();
    return apiClient.get<ComplianceRule[]>(qs ? '/api/compliance/rules?' + qs : '/api/compliance/rules');
  },

  getRule: (id: string) => apiClient.get<ComplianceRule>('/api/compliance/rules/' + id),

  createRule: (data: ComplianceRuleCreate) => apiClient.post<ComplianceRule>('/api/compliance/rules', data),

  updateRule: (id: string, data: ComplianceRuleUpdate) => apiClient.put<ComplianceRule>('/api/compliance/rules/' + id, data),

  deleteRule: (id: string) => apiClient.delete<void>('/api/compliance/rules/' + id),

  /** Every rule run against its own examples. */
  selfTest: () => apiClient.get<RuleSelfTest[]>('/api/compliance/rules/self-test'),

  /** Per rule: flags on submitted versions and how many reviewers dismissed. */
  flagStats: () => apiClient.get<RuleFlagStats[]>('/api/compliance/rules/flag-stats'),

  checkCompliance: (data: ComplianceCheckRequest, options?: { skipGlobalLoading?: boolean }) =>
    apiClient.post<ComplianceCheckResponse>('/api/compliance/check', data, options ?? { skipGlobalLoading: true }),

  getStats: () => apiClient.get<ComplianceStats>('/api/compliance/stats'),

  resetDefaults: () => apiClient.post<{ status: string; message: string }>('/api/compliance/rules/reset-defaults'),

  startVideoJob: (data: { filename: string; video_title: string; platform?: string; aspect_ratio?: string }) =>
    apiClient.post<VideoJob>('/api/compliance/jobs/video-upload', data),

  getVideoJob: (jobId: string) => apiClient.get<VideoJob>('/api/compliance/jobs/' + jobId),
};

