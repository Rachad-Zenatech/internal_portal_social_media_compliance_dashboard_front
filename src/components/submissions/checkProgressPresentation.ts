import type { CheckAttempt } from "@/types/checkAttempt";

const LABELS: Record<string, string> = {
  COMPLIANCE_CHECK: "Rulebook check", CONTEXT_EVAL: "Context review", SOURCE_CHECK: "Checking supporting evidence",
  IMAGE_TEXT: "Reading text in images", TRANSCRIPTION: "Reading the video's speech", DOCUMENT_TEXT: "Reading the script",
  SOURCE_PDF_TEXT: "Reading source PDF",
};
const ERRORS: Record<string, string> = {
  MODEL: "Model unavailable", BUSY: "Service busy or timed out", QUOTA: "Usage limit reached", KEY: "API key problem",
};
export const stepLabel = (feature: string) => LABELS[feature] ?? feature.toLowerCase().replace(/_/g, " ");
export const duration = (ms?: number) => ms == null ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`;
export const taskLabel = (a: CheckAttempt) => a.progress_label || (a.feature === "SOURCE_CHECK"
  ? "Checking claims and supporting evidence" : stepLabel(a.feature));

export function relation(attempts: CheckAttempt[], index: number) {
  const current = attempts[index];
  if (!current.task_id) return null; // Older events cannot establish which requests belong together.
  const previous = attempts.slice(0, index).filter(a => a.task_id === current.task_id && a.status === "FAILED").at(-1);
  return previous ? previous.model === current.model ? "Retry" : "Fallback" : null;
}

export function retryCounts(attempts: CheckAttempt[]) {
  return { retries: attempts.filter((_, i) => relation(attempts, i) === "Retry").length,
    fallbacks: attempts.filter((_, i) => relation(attempts, i) === "Fallback").length,
    failed: attempts.filter(a => a.status === "FAILED").length };
}

export function groups(attempts: CheckAttempt[]) {
  const result: { feature: string; attempts: CheckAttempt[] }[] = [];
  for (const attempt of attempts) {
    const group = result.find(item => item.feature === attempt.feature);
    if (group) group.attempts.push(attempt);
    else result.push({ feature: attempt.feature, attempts: [attempt] });
  }
  return result;
}

export function summary(attempts: CheckAttempt[]) {
  const latest = new Map<string, CheckAttempt>();
  attempts.forEach(a => latest.set(a.task_id || a.id, a));
  const tasks = [...latest.values()];
  return { completed: tasks.filter(a => a.status === "OK").length,
    running: tasks.filter(a => a.status === "RUNNING").length,
    failed: tasks.filter(a => a.status === "FAILED").length };
}

export function outcome(a: CheckAttempt) {
  if (a.status === "RUNNING") return "In progress";
  if (a.status === "OK") return `Completed${a.duration_ms == null ? "" : ` in ${duration(a.duration_ms)}`}`;
  return `${ERRORS[a.error_kind || ""] || "Request failed"}${a.duration_ms == null ? "" : ` (${duration(a.duration_ms)})`}`;
}
