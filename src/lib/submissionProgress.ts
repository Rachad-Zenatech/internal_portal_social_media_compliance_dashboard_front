import { ranOnce, RAN_STEP_STATES } from "@/lib/postSteps";
import { creatorPreparationSteps } from "@/lib/revisionSteps";
import type { SubmissionSteps, SubmissionSummary } from "@/types/submission";

export function isScriptPreparation(s: SubmissionSummary): boolean {
  return s.content_type === "VIDEO" && !s.cover?.mime_type.startsWith("video/");
}

/** Use one state for the dots, count and resume link, including script-only requirements. */
export function creatorSubmissionSteps(s: SubmissionSummary): SubmissionSteps | null | undefined {
  const steps = s.steps;
  if (!steps) return steps;
  const scriptOnly = isScriptPreparation(s);
  if (s.status === "CHANGES_REQUESTED") {
    if (steps.revision) return steps;
    return { ...steps, revision: true, suggestions: "todo", details: "todo", compliance: "todo",
      sentiment: "todo", send: "todo", locked: false, next: "suggestions", ready_to_send: false };
  }
  if (!scriptOnly) return ranOnce(steps, s.content_type === "TEXT_POST");
  if (s.script_status === "IN_REVIEW" || s.script_status === "APPROVED") {
    return { ...steps, details: "done", compliance: "done", send: "done",
      locked: s.script_status === "IN_REVIEW", ready_to_send: false, next: null, missing: [] };
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
  if (isScriptPreparation(s) && s.script_status === "APPROVED") return "Script approved \u00b7 Upload video";
  const preparation = creatorPreparationSteps(isScriptPreparation(s) || s.content_type === "TEXT_POST", steps.revision);
  const done = preparation.filter((step) => RAN_STEP_STATES.has(steps[step.key] ?? "todo")).length;
  if (steps.locked) {
    return s.script_status === "IN_REVIEW"
      ? `${done} of ${preparation.length} steps complete \u00b7 Sent for review`
      : lockedLabel;
  }
  if (steps.ready_to_send) return "Ready to send";
  return `${done} of ${preparation.length} steps done`;
}
