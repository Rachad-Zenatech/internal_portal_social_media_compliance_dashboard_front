import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import ScriptCompliance, { activeFlagCount } from "@/components/script/ScriptCompliance";
import { Button } from "@/components/ui/button";
import { scriptVerdict } from "@/lib/scriptStage";
import { cn } from "@/lib/utils";
import type { StoredCheck } from "@/types/submission";

/**
 * The compliance check a creator runs on a script before sending it, like a post's compliance step: run it, see the
 * score and every flag, fix the script and run it again. Sending waits for a check of the script as it is now.
 */
export default function ScriptPrecheck({
  check,
  stale = false,
  checkedAt,
  checking = false,
  canCheck = true,
  onCheck,
  compact = false,
}: {
  check?: StoredCheck | null;
  /** The script (or its details) changed since this check. */
  stale?: boolean;
  checkedAt?: string | null;
  checking?: boolean;
  canCheck?: boolean;
  onCheck: () => void;
  /** In a batch card: the flags are listed by the card itself, so only the score line and the button show. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const verdict = scriptVerdict(check);
  const flags = activeFlagCount(check);

  const button = (label: string, primary: boolean) => (
    <Button
      type="button"
      size="sm"
      variant={primary ? "default" : "outline"}
      onClick={onCheck}
      disabled={checking || !canCheck}
      className={cn("h-8 gap-1.5 text-xs", primary && "bg-blue-700 text-white hover:bg-blue-800")}
    >
      {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primary ? <ShieldCheck className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {checking ? "Checking…" : label}
    </Button>
  );

  if (!check) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-blue-300 bg-card px-3.5 py-3 dark:border-blue-500/40">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">Check compliance before sending</p>
          <p className="text-xs text-muted-foreground">
            {checking
              ? "Reading the script against the rulebook. This takes about half a minute."
              : "See the score and anything to fix first, the way the reviewer will see it."}
          </p>
        </div>
        {button("Check compliance", true)}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card", stale ? "border-amber-300 dark:border-amber-500/50" : verdict.ring)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
            {check.ai_unavailable || check.score == null ? "–" : check.score}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">/100</span>
          </span>
          <div className="min-w-0">
            <p className={cn("text-[13px] font-semibold", verdict.tone)}>{verdict.text}</p>
            <p className="text-xs text-muted-foreground">
              {check.ai_unavailable ? "The AI review couldn't run; check again later" : flags ? `${flags} flag${flags === 1 ? "" : "s"} to look at` : "No flags"}
              {checkedAt ? ` · checked ${formatDistanceToNow(new Date(checkedAt), { addSuffix: true })}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (check.violations?.length ?? 0) > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Hide the flags" : "See the flags"} {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          )}
          {button("Check again", stale)}
        </div>
      </div>
      {stale && (
        <p className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The script or its details changed since this check. Check it again before sending.
        </p>
      )}
      {open && !compact && (
        <div className="border-t border-border/70 p-3.5">
          <ScriptCompliance check={check} />
        </div>
      )}
    </div>
  );
}
