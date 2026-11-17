import { postPreparationSteps, ranOnce } from "@/lib/postSteps";
import type { SubmissionSteps, SubmissionSummary } from "@/types/submission";

export function isScriptPreparation(s: SubmissionSummary): boolean {
  return s.content_type === "VIDEO" && !s.cover?.mime_type.startsWith("video/");
}

/** Use one state for the dots, count and resume link, including script-only requirements. */
export function creatorSubmissionSteps(s: SubmissionSummary): SubmissionSteps | null | undefined {
  const steps = s.steps;
  if (!steps) return steps;
  const scriptOnly = isScriptPreparation(s);
  if (!scriptOnly) return ranOnce(steps);
  if (s.script_status === "IN_REVIEW") {
    return { ...steps, details: "done", compliance: "done", send: "done",
      locked: true, ready_to_send: false, next: null, missing: [] };
  }
  if (steps.locked) return steps;
  const attached = s.has_script ?? Boolean(s.script_excerpt?.trim());
  const videoFields = new Set(["caption", "main_file", "script_approval", "script"]);
  const missing = steps.missing.filter((field) => !videoFields.has(field));
  if (!attached) missing.push("script");
  return ranOnce({ ...steps, details: missing.length ? "todo" : "done", missing }, true);
}

export function creatorProgressText(s: SubmissionSummary, lockedLabel: string): string {
  const steps = s.steps;
  if (!steps) return "";
  const preparation = postPreparationSteps(isScriptPreparation(s));
  const done = preparation.filter((step) => steps[step.key] === "done").length;
  if (steps.locked) {
    return s.script_status === "IN_REVIEW"
      ? `${done} of ${preparation.length} steps complete \u00b7 Sent for review`
      : lockedLabel;
  }
  if (steps.ready_to_send) return "Ready to send";
  return `${done} of ${preparation.length} steps done`;
}
