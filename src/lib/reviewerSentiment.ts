import type { SentimentAssessment, SentimentFinding, SentimentResult } from "@/types/sentiment";

export const REVIEW_ASSESSMENTS: Record<SentimentAssessment, string> = {
  NO_CONCERNS: "No concerns", REVIEW_SUGGESTED: "Worth a closer look",
  SIGNIFICANT_CONCERNS: "Significant concerns", INSUFFICIENT_INFORMATION: "Not enough information",
};

export function readableSentiment(value: string): string {
  const words = value.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Preserve the creator's findings and put the most serious points first. */
export function prioritiseSentiment(findings: SentimentFinding[]): SentimentFinding[] {
  const priority = { HIGH: 0, MODERATE: 1, LOW: 2 };
  return [...findings].sort((a, b) => priority[a.severity] - priority[b.severity]);
}

export function sentimentBrandFit(result: SentimentResult): string {
  const voice = result.context_report?.brand_voice.verdict;
  const labels = { ON_VOICE: "On brand", MOSTLY_ON_VOICE: "Mostly on brand", OFF_VOICE: "Needs attention", NO_GUIDE: "No guide available" };
  return voice ? labels[voice] : readableSentiment(result.brand_alignment.rating);
}

/** Brief supporting context, using the same saved result the creator sees. */
export function sentimentContext(result: SentimentResult): { label: string; text: string }[] {
  const report = result.context_report;
  const context = [
    { label: "Brand voice", text: report?.brand_voice.summary ?? result.brand_alignment.explanation },
    { label: "Platform fit", text: report?.platform_norms.summary },
    { label: "Audience fit", text: report?.audiences.summary },
    { label: "Visuals and caption", text: result.visual_alignment?.explanation },
    { label: "Audio", text: result.audio?.explanation },
    { label: "Controversy", text: result.controversy.applies ? result.controversy.explanation : null },
  ];
  return context.filter((item): item is { label: string; text: string } => Boolean(item.text?.trim()));
}

/** Keep important audience and media caveats visible without expanding the full report. */
export function sentimentWatchouts(result: SentimentResult): { label: string; text: string }[] {
  const items = result.audience_interpretations.filter((audience) => ["MODERATE", "HIGH"].includes(audience.concern_level))
    .map((audience) => ({ label: audience.audience, text: audience.likely_reading }));
  if (result.visual_alignment?.verdict === "MISMATCH") items.push({ label: "Visuals and caption", text: result.visual_alignment.explanation });
  if (result.audio?.fits_message === false) items.push({ label: "Audio", text: result.audio.explanation || "Check whether the audio fits the message." });
  return items;
}
