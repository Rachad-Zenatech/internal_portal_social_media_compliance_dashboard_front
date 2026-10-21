/** Gemini sentiment analysis of a submission (advisory; mirrors backend models/sentiment_model.py). */

export type SentimentLevel = "NONE" | "LOW" | "MODERATE" | "HIGH";
export type SentimentAssessment = "NO_CONCERNS" | "REVIEW_SUGGESTED" | "SIGNIFICANT_CONCERNS" | "INSUFFICIENT_INFORMATION";
export type SentimentStatus = "WAITING_TRANSCRIPT" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface SentimentFinding {
  category: "TONE" | "BRAND" | "AUDIENCE" | "CONTROVERSY" | "REPUTATION" | "CLARITY";
  severity: "LOW" | "MODERATE" | "HIGH";
  title: string;
  quote: string;
  why_it_matters: string;
  basis: "OBSERVED_WORDING" | "POSSIBLE_INTERPRETATION";
  guideline_rule_number?: string | null;
  suggested_revision?: string | null;
  source?: "title" | "caption" | "transcript" | null;
  start_sec?: number | null;
  end_sec?: number | null;
}

export interface SentimentResult {
  summary: string;
  overall_assessment: SentimentAssessment;
  reputational_concern: SentimentLevel;
  tone: { primary: string; secondary?: string | null; intensity: "LOW" | "MEDIUM" | "HIGH"; evidence: string[] };
  brand_alignment: { rating: "ALIGNED" | "PARTIALLY_ALIGNED" | "MISALIGNED" | "INSUFFICIENT_GUIDANCE"; explanation: string };
  audience_interpretations: { audience: string; likely_reading: string; concern_level: SentimentLevel }[];
  controversy: {
    applies: boolean;
    level?: number | null;
    style?: string | null;
    target?: "PROBLEM" | "ECONOMICS" | "SYSTEM_DESIGN" | "PEOPLE_OR_INSTITUTIONS" | "MIXED" | null;
    professional_and_nonpartisan?: boolean | null;
    capability_claims_precise?: boolean | null;
    defense_buyer_credibility_risk?: SentimentLevel | null;
    explanation?: string | null;
  };
  findings: SentimentFinding[];
  information_gaps: string[];
  guidelines_used: string[];
  unverified_findings_removed: number;
}

export interface SentimentAnalysis {
  id: string;
  submission_id: string;
  version_number: number;
  trigger: string;
  status: SentimentStatus;
  model?: string | null;
  prompt_version: string;
  result?: SentimentResult | null;
  error?: string | null;
  /** False when the content, scope or rules changed since it ran. */
  is_current: boolean;
  created_at: string;
  completed_at?: string | null;
}

/** AI usage left in the rolling 24-hour window (GET /api/submissions/ai-usage). */
export interface AiFeatureUsage {
  used: number;
  limit: number;
  company_used: number;
  company_limit: number;
  /** The tightest of the personal, company-wide and per-submission limits; null when unlimited. */
  remaining: number | null;
  resets_at?: string | null;
  company_resets_at?: string | null;
  submission_used?: number;
  submission_limit?: number;
}
export type AiUsage = Record<"SENTIMENT" | "TRANSCRIPTION", AiFeatureUsage>;
