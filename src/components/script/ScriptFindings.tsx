import { useState } from "react";
import { Check, ChevronDown, Loader2, Search, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { FINDING_META, statusOf } from "@/components/submissions/FindingStatus";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComplianceViolation } from "@/services/complianceService";
import { scriptService } from "@/services/scriptService";
import type { StoredCheck } from "@/types/submission";

type Fix = { rewrite: string; note?: string | null };

/**
 * A script's compliance findings the way a post shows them: numbered, most serious first, with the points each costs.
 * Click one to see the wording, what to do and why it was flagged, and (while the script can still change) find it in
 * the script, have a compliant rewrite suggested and use it, or add a missing disclaimer.
 */
export default function ScriptFindings({
  check,
  onFind,
  onReplace,
  onAppend,
}: {
  check?: StoredCheck | null;
  /** Select the wording in the script. */
  onFind?: (term: string) => void;
  /** Put the rewrite in place of the quoted wording; false when that wording isn't in the script any more. */
  onReplace?: (quote: string, rewrite: string) => boolean;
  /** Add text (a disclaimer) to the end of the script. */
  onAppend?: (text: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, Fix>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [clearedOpen, setClearedOpen] = useState(false);

  const all = check?.violations ?? [];
  const findings = all
    .filter((v) => statusOf(v) !== "CLEARED")
    .sort((a, b) => Number(b.traffic_light === "RED") - Number(a.traffic_light === "RED") || (b.penalty ?? 0) - (a.penalty ?? 0));
  const cleared = all.filter((v) => statusOf(v) === "CLEARED");
  const keyOf = (v: ComplianceViolation) => `${v.rule_id}-${v.kind ?? ""}`;
  const quoteOf = (v: ComplianceViolation) => (v.passage || v.flagged_terms[0] || "").trim();

  const suggest = async (v: ComplianceViolation) => {
    const key = keyOf(v);
    setLoading(key);
    try {
      const fix = await scriptService.suggestFix({
        passage: quoteOf(v),
        flagged_terms: v.flagged_terms,
        rule_title: v.title,
        explanation: v.explanation,
        guidance: v.remediation_guidance ?? null,
      });
      setFixes((prev) => ({ ...prev, [key]: fix }));
    } catch (err) {
      toast.error(`Couldn't suggest a fix: ${(err as Error).message}`);
    } finally {
      setLoading(null);
    }
  };
  const use = (v: ComplianceViolation, text: string, how: "replace" | "append") => {
    const key = keyOf(v);
    if (how === "replace") {
      if (!onReplace?.(quoteOf(v), text)) {
        toast.error("That wording isn't in the script any more. Find it and edit it by hand.");
        return;
      }
    } else onAppend?.(text);
    setUsed((prev) => new Set(prev).add(key));
    toast.success("Changed in the script. Save it, then check again to update the score.");
  };

  if (!check) return null;
  if (findings.length === 0 && cleared.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
        <Check className="h-4 w-4" strokeWidth={3} /> Nothing in this script broke a rule.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {findings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {findings.length} finding{findings.length === 1 ? "" : "s"}. Click one to see where it is and how to fix it.
        </p>
      )}
      {findings.map((v, i) => {
        const key = keyOf(v);
        const st = statusOf(v);
        const red = v.traffic_light === "RED" || st === "VIOLATION";
        const on = picked === key;
        const missing = v.kind === "MISSING_DISCLAIMER";
        const fix = fixes[key];
        const done = used.has(key);
        return (
          <article
            key={key}
            className={cn(
              "overflow-hidden rounded-xl border-2 transition-colors",
              on ? (red ? "border-red-500 bg-red-50/50 dark:bg-red-500/10" : "border-amber-500 bg-amber-50/50 dark:bg-amber-500/10") : "border-border/70 bg-card hover:border-border"
            )}
          >
            <button
              type="button"
              aria-expanded={on}
              onClick={() => {
                setPicked(on ? null : key);
                if (!on && !missing && v.flagged_terms[0]) onFind?.(v.flagged_terms[0]);
              }}
              className="flex w-full gap-3 p-3 text-left"
            >
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white", red ? "bg-red-600" : "bg-amber-600")}>
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", FINDING_META[st].pill)}>{st === "VIOLATION" ? "Issue" : FINDING_META[st].label}</span>
                  <RuleNumberBadge v={v} />
                  <span className="text-[11px] font-semibold text-muted-foreground">{missing ? "Missing disclaimer" : "In the script"}</span>
                  <span className={cn("ml-auto text-xs font-bold tabular-nums", red ? "text-red-600" : "text-amber-700 dark:text-amber-300")}>
                    {(v.penalty ?? 0) > 0 ? `−${v.penalty} points` : "No points"}
                  </span>
                </span>
                <span className="text-sm font-semibold leading-snug text-foreground">{v.title}</span>
              </span>
              <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", on && "rotate-180")} />
            </button>

            {on && (
              <div className="flex flex-col gap-2.5 px-3 pb-3 pl-12">
                {!missing && v.flagged_terms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {v.flagged_terms.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onFind?.(t)}
                        disabled={!onFind}
                        title={onFind ? "Find it in the script" : undefined}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-default dark:bg-amber-500/15 dark:text-amber-200"
                      >
                        {onFind && <Search className="h-3 w-3" />}“{t}”
                      </button>
                    ))}
                  </div>
                )}
                {v.passage && !missing && <p className="rounded-lg border border-border/70 bg-card px-2.5 py-2 text-[13px] italic text-muted-foreground">{v.passage}</p>}
                <p className="text-[13px] leading-relaxed text-foreground/85">
                  <strong className="font-semibold">What to do:</strong> {v.remediation_guidance || v.explanation}
                </p>
                {v.evaluation?.reasoning && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="font-semibold text-foreground/80">Why it was flagged:</strong> {v.evaluation.reasoning}
                  </p>
                )}

                {/* A missing disclaimer: add it in one click. */}
                {missing && onAppend && (v.missing_disclaimers?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-foreground/80">“{v.missing_disclaimers![0]}”</p>
                    <Button type="button" size="sm" variant="outline" className="h-7 w-fit gap-1.5 text-xs" disabled={done} onClick={() => use(v, v.missing_disclaimers![0], "append")}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                      {done ? "Added to the end of the script" : "Add this disclaimer to the end"}
                    </Button>
                  </div>
                )}

                {/* Wording: have a compliant rewrite suggested, then use it. */}
                {!missing && onReplace && quoteOf(v) && (
                  fix ? (
                    <div className="flex flex-col gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">Suggested wording</p>
                      <p className="text-[13px] text-foreground">{fix.rewrite}</p>
                      {fix.note && <p className="text-[11px] text-muted-foreground">{fix.note}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 gap-1.5 bg-blue-700 text-xs text-white hover:bg-blue-800"
                          disabled={done}
                          onClick={() => use(v, fix.rewrite, "replace")}
                        >
                          <Check className="h-3.5 w-3.5" /> {done ? "Used in the script" : "Use this wording"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" disabled={loading === key || done} onClick={() => void suggest(v)}>
                          {loading === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Another suggestion
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="h-7 w-fit gap-1.5 text-xs" disabled={loading === key} onClick={() => void suggest(v)}>
                      {loading === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {loading === key ? "Writing a suggestion…" : "Suggest a fix"}
                    </Button>
                  )
                )}
              </div>
            )}
          </article>
        );
      })}

      {cleared.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
          <button type="button" aria-expanded={clearedOpen} onClick={() => setClearedOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
            <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
            <span className="flex-1">
              <strong className="font-semibold">{cleared.length} cleared by context:</strong> the wording matched a rule, but the sentence shows it doesn't apply.
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", clearedOpen && "rotate-180")} />
          </button>
          {clearedOpen && (
            <ul className="flex flex-col gap-1.5 border-t border-emerald-200 px-3 py-2 dark:border-emerald-500/30">
              {cleared.map((v) => (
                <li key={keyOf(v)} className="text-foreground">
                  <span className="font-semibold">{v.title}</span>
                  {v.flagged_terms.length > 0 && <span className="text-muted-foreground"> · {v.flagged_terms.map((t) => `“${t}”`).join(", ")}</span>}
                  {v.evaluation?.reasoning && <span className="block text-muted-foreground">{v.evaluation.reasoning}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
