import { Check, Loader2, RefreshCw } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { POST_STEPS, missingText, stepStatusText } from "@/lib/postSteps";
import type { PostStepKey, PostStepState, SubmissionSteps } from "@/types/submission";

/**
 * The five steps of a post as five dots, in order. Hover one for what the step is for and where it stands; click it to
 * open that step. The send step stays shut until the four before it are done. Once a post is sent every step is locked:
 * a click still opens it, but only to read.
 */
export default function PostSteps({
  steps,
  onOpen,
  size = "md",
  className = "",
}: {
  steps: SubmissionSteps;
  onOpen: (step: PostStepKey) => void;
  /** lg: the dots grow on wide screens (the My posts rows). */
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <ol aria-label="Steps" className={`flex items-center gap-1.5 ${size === "lg" ? "2xl:gap-2.5" : ""} ${className}`}>
        {POST_STEPS.map((step, i) => {
          const state: PostStepState = steps[step.key];
          // Where it was left off: the step a click on the post opens.
          const current = !steps.locked && steps.next === step.key;
          // Sending waits for the steps before it.
          const shut = !steps.locked && step.key === "send" && !steps.ready_to_send;
          const tone = steps.locked
            ? "border-[#9AA9C9] bg-[#9AA9C9] text-white"
            : state === "done"
            ? "border-blue-700 bg-blue-700 text-white"
            : state === "stale"
            ? "border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
            : state === "running"
            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            : shut
            ? "border-slate-300 bg-card text-slate-400 opacity-60 dark:border-slate-600"
            : "border-slate-300 bg-card text-slate-500 dark:border-slate-600";
          return (
            <li key={step.key} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${step.label}${shut ? " (not available yet)" : ""}`}
                    aria-disabled={shut || undefined}
                    aria-current={current ? "step" : undefined}
                    onClick={(e) => {
                      // A step is its own link: it must not also open the post it sits on.
                      e.stopPropagation();
                      if (!shut) onOpen(step.key);
                    }}
                    className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 text-[10px] font-bold ${size === "lg" ? "2xl:h-8 2xl:w-8 2xl:text-xs" : ""} transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${tone} ${
                      shut ? "cursor-not-allowed" : "cursor-pointer hover:scale-110 hover:shadow-sm"
                    } ${current ? "ring-2 ring-blue-500/60 ring-offset-1 ring-offset-card" : ""}`}
                  >
                    {state === "done" || steps.locked ? (
                      <Check className={size === "lg" ? "h-2.5 w-2.5 2xl:h-4 2xl:w-4" : "h-2.5 w-2.5"} strokeWidth={4} />
                    ) : state === "running" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : state === "stale" ? (
                      <RefreshCw className="h-2.5 w-2.5" />
                    ) : (
                      i + 1
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[16rem] flex-col items-start gap-1 rounded-xl border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg"
                >
                  <span className="text-[13px] font-semibold text-foreground">
                    {i + 1}. {step.label}
                  </span>
                  <span>{step.purpose}</span>
                  <span
                    className={`font-medium ${
                      steps.locked
                        ? "text-muted-foreground"
                        : state === "stale"
                        ? "text-amber-700 dark:text-amber-300"
                        : state === "done"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stepStatusText(step.key, state, steps)}
                    {!steps.locked && step.key === "details" && state === "todo" ? ` ${missingText(steps.missing)}` : ""}
                  </span>
                  {current && <span className="font-semibold text-blue-700 dark:text-blue-300">You left off here.</span>}
                  {!shut && <span className="text-muted-foreground">{steps.locked ? "Click to read it." : "Click to open it."}</span>}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
