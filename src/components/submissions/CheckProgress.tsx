import { useEffect, useState } from "react";
import { CheckCircle2, CornerDownRight, Loader2, XCircle } from "lucide-react";

import type { CheckAttempt } from "@/types/submission";

/** What each AI step of the check is, in the creator's words. */
const STEP_LABELS: Record<string, string> = {
  COMPLIANCE_CHECK: "Rulebook check",
  CONTEXT_EVAL: "Context review",
  IMAGE_TEXT: "Reading text in images",
  TRANSCRIPTION: "Reading the video's speech",
  DOCUMENT_TEXT: "Reading the script",
};

/** Why a model was skipped for the next one. */
const FAILURE_LABELS: Record<string, string> = {
  MODEL: "not available for this API key",
  BUSY: "busy or timed out",
  QUOTA: "usage limit reached",
  KEY: "API key problem",
  OTHER: "failed",
};

const stepLabel = (feature: string) =>
  STEP_LABELS[feature] ?? feature.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const seconds = (ms?: number) => (ms == null ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`);

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((now - since) / 1000))}s</span>;
}

/** Each step's model attempts in the order they ran; a model tried after another failed is a fallback. */
function AttemptList({ attempts }: { attempts: CheckAttempt[] }) {
  const steps: { feature: string; attempts: CheckAttempt[] }[] = [];
  for (const a of attempts) {
    const step = steps.find((s) => s.feature === a.feature);
    if (step) step.attempts.push(a);
    else steps.push({ feature: a.feature, attempts: [a] });
  }
  return (
    <div className="space-y-2.5">
      {steps.map((step) => (
        <div key={step.feature} className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stepLabel(step.feature)}</p>
          <ul className="space-y-1">
            {step.attempts.map((a, i) => {
              const fallback = step.attempts.slice(0, i).some((p) => p.status === "FAILED");
              return (
                <li key={a.id} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${fallback ? "pl-4" : ""}`}>
                  {fallback && <CornerDownRight className="-ml-4 h-3 w-3 shrink-0 text-muted-foreground" />}
                  {a.status === "RUNNING" ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
                  ) : a.status === "OK" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  )}
                  <span className="font-mono text-foreground">{a.model}</span>
                  {fallback && (
                    <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                      Fallback
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {a.status === "RUNNING"
                      ? "working..."
                      : a.status === "OK"
                      ? `answered in ${seconds(a.duration_ms)}`
                      : `${FAILURE_LABELS[a.error_kind ?? "OTHER"] ?? "failed"} (${seconds(a.duration_ms)}), trying the next model`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Shown in place of the result while a compliance check runs: elapsed time and every model tried so far. */
export function CheckProgress({ attempts, startedAt }: { attempts: CheckAttempt[]; startedAt: number }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-3 dark:border-blue-500/30 dark:bg-blue-500/5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Checking your post...
        </p>
        <span className="text-xs text-muted-foreground">
          <Elapsed since={startedAt} />
        </span>
      </div>
      {attempts.length ? (
        <AttemptList attempts={attempts} />
      ) : (
        <p className="text-xs text-muted-foreground">Saving your draft and reading the post...</p>
      )}
      <p className="text-[11px] text-muted-foreground">The new score appears here when every step is done.</p>
    </div>
  );
}

/** After a check: which models answered, and how many fallbacks it took. */
export function CheckModelsUsed({ attempts, durationMs }: { attempts: CheckAttempt[]; durationMs: number }) {
  const [open, setOpen] = useState(false);
  if (!attempts.length) return null;
  const used = [...new Set(attempts.filter((a) => a.status === "OK").map((a) => a.model))];
  const failed = attempts.filter((a) => a.status === "FAILED").length;
  return (
    <div className="text-[11px] text-muted-foreground">
      <button type="button" onClick={() => setOpen((o) => !o)} className="hover:underline">
        Checked in {seconds(durationMs)} with {used.join(", ") || "no model"}
        {failed > 0 && ` after ${failed} fallback${failed === 1 ? "" : "s"}`} · {open ? "Hide models" : "Show models"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border/70 p-3">
          <AttemptList attempts={attempts} />
        </div>
      )}
    </div>
  );
}

/** The models a saved check used, read from the saved result, so it shows after a reload too. */
export function SavedCheckModels({ models }: { models?: { attempts: CheckAttempt[]; duration_ms: number } | null }) {
  if (!models) {
    return <p className="text-[11px] text-muted-foreground">Which model ran isn't recorded for this check. Check again to see it.</p>;
  }
  if (!models.attempts.length) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No AI model was called for this check ({seconds(models.duration_ms)}), so it used the wording rules and any answer already saved for the same text.
      </p>
    );
  }
  return <CheckModelsUsed attempts={models.attempts} durationMs={models.duration_ms} />;
}
