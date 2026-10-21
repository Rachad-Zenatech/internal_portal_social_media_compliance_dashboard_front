import { apiClient } from '@/services/apiClient';

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
}

export interface ComplianceRuleUpdate {
  rule_number?: string;
  category?: string;
  title?: string;
  summary?: string;
  severity?: ComplianceSeverity;
  traffic_light?: TrafficLight;
  prohibited_terms?: string[];
  required_disclaimers?: string[];
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
}

export interface ComplianceCheckResponse {
  is_compliant: boolean;
  traffic_light: TrafficLight;
  score: number;
  violations_count: number;
  violations: ComplianceViolation[];
  recommendations: string[];
  /** How many active rules applied to the content's scope (missing on checks saved before scoping). */
  rules_checked?: number;
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

  checkCompliance: (data: ComplianceCheckRequest) =>
    apiClient.post<ComplianceCheckResponse>('/api/compliance/check', data),

  getStats: () => apiClient.get<ComplianceStats>('/api/compliance/stats'),

  resetDefaults: () => apiClient.post<{ status: string; message: string }>('/api/compliance/rules/reset-defaults'),

  startVideoJob: (data: { filename: string; video_title: string; platform?: string; aspect_ratio?: string }) =>
    apiClient.post<VideoJob>('/api/compliance/jobs/video-upload', data),

  getVideoJob: (jobId: string) => apiClient.get<VideoJob>('/api/compliance/jobs/' + jobId),
};

