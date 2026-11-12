import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shown while a check runs (compliance, sentiment, public mood): a gentle animation and a plain message that it can take
 * a few seconds or a few minutes, that nobody has to wait on this page, and where to see how it is going.
 */
export default function CheckingNotice({
  what = "compliance",
  className,
  compact = false,
}: {
  /** What is being checked, as it reads in "Checking for …": "compliance", "sentiment", "public mood". */
  what?: string;
  className?: string;
  /** One short line, for tight spots. */
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-3 dark:border-blue-500/30 dark:bg-blue-500/10", className)}
    >
      <div className="flex items-center gap-3">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/30" />
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-blue-950 dark:text-blue-100">Checking for {what}…</p>
          <p className="text-xs text-blue-900/80 dark:text-blue-200/80">
            {compact
              ? "A few seconds to a few minutes. Keep using the site."
              : "Give us a few seconds, sometimes a few minutes. You don't have to wait here: use other tools on the site while it runs. Progress shows at the bottom right on every page."}
          </p>
        </div>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-500/20">
        <div className="relative h-full w-full">
          <span className="absolute h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ animation: "indeterminate 1.4s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}
