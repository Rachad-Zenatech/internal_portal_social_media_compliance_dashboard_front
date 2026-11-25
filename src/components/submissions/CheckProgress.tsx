import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { CheckAttempt } from "@/types/submission";
import { AttemptList } from "./CheckAttemptList";
import { retryCounts } from "./checkProgressPresentation";

const seconds = (ms?: number) => (ms == null ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`);

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.max(0, Math.round((now - since) / 1000))}s</span>;
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
  const { retries, fallbacks, failed } = retryCounts(attempts);
  const followups = [retries ? `${retries} retr${retries === 1 ? "y" : "ies"}` : "",
    fallbacks ? `${fallbacks} model switch${fallbacks === 1 ? "" : "es"}` : "",
    failed ? `${failed} failed request${failed === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
  return (
    <div className="text-[11px] text-muted-foreground">
      <button type="button" onClick={() => setOpen((o) => !o)} className="hover:underline">
        Checked in {seconds(durationMs)} with {used.join(", ") || "no model"}
        {followups && ` ? ${followups}`} · {open ? "Hide models" : "Show models"}
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
