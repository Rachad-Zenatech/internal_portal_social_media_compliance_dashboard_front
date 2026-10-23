/** Gemini sentiment analysis of a submission (advisory; mirrors backend models/sentiment_model.py). */

export type SentimentLevel = "NONE" | "LOW" | "MODERATE" | "HIGH";
export type SentimentAssessment = "NO_CONCERNS" | "REVIEW_SUGGESTED" | "SIGNIFICANT_CONCERNS" | "INSUFFICIENT_INFORMATION";
/** SCHEDULED: stopped by Gemini's daily limit, set to run again once it resets (retry_at). */
export type SentimentStatus = "WAITING_TRANSCRIPT" | "SCHEDULED" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type FindingVerdict = "USEFUL" | "NOT_AN_ISSUE";

export interface SentimentFinding {
  /** Stable within the analysis; reviewer feedback points at it. */
  id?: string | null;
  category: "TONE" | "BRAND" | "AUDIENCE" | "CONTROVERSY" | "REPUTATION" | "CLARITY";
  severity: "LOW" | "MODERATE" | "HIGH";
  title: string;
  quote: string;
  why_it_matters: string;
  /** OBSERVED_VISUAL / OBSERVED_AUDIO: about what an image or the video shows, or how it sounds; quote then describes it. */
  basis: "OBSERVED_WORDING" | "POSSIBLE_INTERPRETATION" | "OBSERVED_VISUAL" | "OBSERVED_AUDIO";
  guideline_rule_number?: string | null;
  suggested_revision?: string | null;
  source?: "title" | "caption" | "transcript" | "video" | "image" | null;
  start_sec?: number | null;
  end_sec?: number | null;
  /** Findings about an image: which one (1 = the first, matching SentimentAnalysis.images). */
  image_index?: number | null;
  /** The past review this finding follows, e.g. "SUB-1012 v2" (one of SentimentResult.precedents). */
  precedent?: string | null;
}

/** A past review of similar content, given to the analysis as precedent for how this team judges such posts. */
export interface SentimentPrecedent {
  label: string;
  submission_id?: string | null;
  reference_code?: string | null;
  version?: number | null;
  title?: string | null;
  decision: "APPROVE" | "REQUEST_CHANGES" | string;
  notes?: string | null;
  decided_at?: string | null;
  /** 0-1; 1 is the same content. */
  similarity: number;
  /** An earlier version of this same post. */
  same_post?: boolean;
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
  /** How the video sounds (null without a video). */
  audio?: {
    voiceover?: string | null;
    music?: string | null;
    sound_effects?: string | null;
    fits_message?: boolean | null;
    explanation?: string | null;
  } | null;
  /** Similar past reviews it was given as precedent. */
  precedents?: SentimentPrecedent[];
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
  /** The Messaging Context entries it was given (e.g. "LinkedIn", "Investors"). */
  context_used?: string[];
  /** Shaun's or investor-facing content, analysed with the stronger model. */
  high_stakes?: boolean;
  /** A video was analysed, so findings with a time can show that frame. */
  has_video?: boolean;
  /** The images it looked at, in order. */
  images?: { index: number; name: string }[];
  /** How it differs from the previous completed analysis, when there is one. */
  comparison?: SentimentComparison | null;
  /** Reviewer votes per finding id, with the viewer's own. */
  feedback?: Record<string, FindingFeedback>;
  /** FAILED on Gemini's daily limit: when it resets. SCHEDULED: when it will run. */
  retry_at?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface SentimentComparison {
  previous_analysis_id: string;
  previous_version: number;
  /** The previous run was of the same version (the draft was edited and re-analysed). */
  same_version: boolean;
  previous_completed_at?: string | null;
  previous_assessment: SentimentAssessment;
  previous_concern: SentimentLevel;
  /** Findings from last time that no longer come up. */
  resolved: SentimentFinding[];
  new_ids: string[];
  still_ids: string[];
}

export interface FindingFeedback {
  useful: number;
  not_an_issue: number;
  mine?: FindingVerdict | null;
  my_note?: string | null;
}

/** A reviewer-saved test case (re-run by scripts/sentiment_eval.py after prompt or model changes). */
export interface SentimentEvalCase {
  id: string;
  reference_code?: string | null;
  title?: string | null;
  expected_assessment: SentimentAssessment;
  expected_concern?: SentimentLevel | null;
  must_flag: string[];
  must_not_flag: string[];
  notes?: string | null;
  created_by_name?: string | null;
  created_at: string;
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
