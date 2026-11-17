import { postPreparationSteps } from "@/lib/postSteps";
import type { PostStepKey } from "@/types/submission";

export type CreatorStepKey = PostStepKey | "suggestions";
export const REVISION_STEPS: { key: CreatorStepKey; label: string; purpose: string }[] = [
  { key: "suggestions", label: "Check the suggestions", purpose: "Read the reviewer feedback and resolve the comments." },
  { key: "details", label: "Make the changes", purpose: "Update the post as requested by the reviewer." },
  { key: "compliance", label: "Compliance", purpose: "Check the updated post against the rulebook again." },
  { key: "sentiment", label: "Sentiment", purpose: "Run sentiment analysis on the updated post." },
  { key: "send", label: "Reviewers", purpose: "Keep the reviewers, add more if needed, and resubmit." },
];

export function creatorPreparationSteps(scriptOnly = false, revision = false) {
  return revision ? REVISION_STEPS.filter((step) => !scriptOnly || step.key !== "sentiment") : postPreparationSteps(scriptOnly);
}
