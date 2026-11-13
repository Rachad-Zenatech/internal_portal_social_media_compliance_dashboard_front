import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { POST_STEPS } from "@/lib/postSteps";
import type { PostStepKey } from "@/types/submission";

type TabState = "done" | "stale" | "todo";

/**
 * The five steps along the top of the post editor, the one you're on lit. Each says what it's for when you point at it.
 * The steps after the details stay shut until the details are filled in (the page then says what is missing).
 * It stays pinned to the top while the page scrolls, so the steps are always in view; on a phone it's one row that
 * scrolls sideways, so the pinned bar stays short.
 */
// Pinned flush under the top bar: the negative offsets cancel the page's padding (AppShell's <main> p-2.5/3.5/4), so
// the content scrolling past doesn't show above it.
const STICKY =
  "sticky -top-2.5 sm:-top-3.5 md:-top-4 z-30 rounded-2xl border border-border/70 bg-card p-3 shadow-md shadow-black/5";
export default function PostStepNav<K extends string = PostStepKey>({
  current,
  states,
  shut,
  onGo,
  steps,
}: {
  current: K;
  states: Partial<Record<K, TabState>>;
  /** The steps that can't be opened yet, and why they can't. */
  shut?: Partial<Record<K, string>>;
  onGo: (step: K) => void;
  /** Another set of steps (a post sent back has six); the usual five by default. */
  steps?: { key: K; label: string; purpose: string }[];
}) {
  const list = steps ?? (POST_STEPS as unknown as { key: K; label: string; purpose: string }[]);
  const row = useRef<HTMLOListElement>(null);
  // On a phone the row scrolls sideways: keep the step you're on in view.
  useEffect(() => {
    row.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  return (
    <TooltipProvider delayDuration={150}>
      <nav aria-label="Steps" className={STICKY}>
        <ol ref={row} className={`flex gap-2 overflow-x-auto sm:grid sm:grid-cols-3 sm:overflow-visible ${list.length === 6 ? "xl:grid-cols-6" : "lg:grid-cols-5"}`}>
          {list.map((step, i) => {
            const active = step.key === current;
            const state = states[step.key] ?? "todo";
            const why = shut?.[step.key];
            return (
              <li key={step.key} className="flex min-w-[9.5rem] shrink-0 flex-col gap-1.5 sm:min-w-0 sm:shrink">
                <span className={`block h-1.5 rounded-full ${active || state === "done" ? "bg-blue-600" : state === "stale" ? "bg-blue-200 dark:bg-blue-500/40" : "bg-muted"}`} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-current={active ? "step" : undefined}
                      aria-disabled={why ? true : undefined}
                      onClick={() => !why && onGo(step.key)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        active ? "border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10" : "border-transparent hover:bg-muted/60"
                      } ${why ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : state === "done"
                            ? "border-blue-600 bg-blue-600 text-white"
                            : state === "stale"
                            ? "border-blue-600 bg-card text-blue-700 dark:text-blue-300"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {why ? <Lock className="h-3 w-3" /> : state === "done" && !active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0 text-[13px] font-semibold leading-tight text-foreground">{step.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[16rem] flex-col items-start gap-1 rounded-xl border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg">
                    <span className="text-[13px] font-semibold text-foreground">
                      {i + 1}. {step.label}
                    </span>
                    <span>{step.purpose}</span>
                    {why && <span className="font-medium text-amber-700 dark:text-amber-300">{why}</span>}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </nav>
    </TooltipProvider>
  );
}

/** Shown in place of a step's tool until the post's details are filled in. */
export function StepGate({ missing, onBack }: { missing: string[]; onBack: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div>
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Fill in the post details first</p>
        <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
          The compliance check, sentiment analysis and public mood read the finished post, so they open once the required
          details are in.
        </p>
      </div>
      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {missing.map((m) => (
            <li key={m} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30">
              {m}
            </li>
          ))}
        </ul>
      )}
      <Button type="button" size="sm" className="gap-1.5 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800" onClick={onBack}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back to post details
      </Button>
    </div>
  );
}

/** The back and next buttons under a step. */
export function StepFooter({
  back,
  next,
  busy,
  onSave,
  saving,
}: {
  back?: { label: string; onClick: () => void };
  next?: { label: string; onClick: () => void; disabled?: boolean };
  busy?: boolean;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-xs">
      {back ? (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs font-semibold" onClick={back.onClick}>
          <ArrowLeft className="h-3.5 w-3.5" /> {back.label}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
      {onSave && (
        <Button type="button" variant="outline" disabled={saving || busy} onClick={onSave} className="h-10 gap-1.5 rounded-lg px-4 text-sm font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
        </Button>
      )}
      {next && (
        <Button
          type="button"
          size="sm"
          disabled={busy || next.disabled}
          onClick={next.onClick}
          className="h-10 gap-1.5 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {next.label}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>
      )}
      </div>
    </div>
  );
}
