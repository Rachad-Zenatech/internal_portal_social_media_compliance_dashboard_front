import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";

import type { ComplianceViolation, FindingStatus } from "@/services/complianceService";

/** What a finding amounts to; checks saved before statuses existed only had violations. */
export const statusOf = (v: Pick<ComplianceViolation, "status">): FindingStatus => v.status ?? "VIOLATION";

export const isWarning = (v: Pick<ComplianceViolation, "status">) => {
  const s = statusOf(v);
  return s === "NEEDS_REVIEW" || s === "EVIDENCE_REQUIRED";
};

interface Meta {
  label: string;
  /** The heading over a group of these. */
  group: string;
  hint: string;
  pill: string;
  card: string;
}

export const FINDING_META: Record<FindingStatus, Meta> = {
  VIOLATION: {
    label: "Violation",
    group: "Violations",
    hint: "Breaks a rule. These cost points; a critical one blocks publication.",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    card: "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    group: "Needs review",
    hint: "Depends on something the text can't show, such as the final footage. Doesn't lower the score or stop approval.",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    card: "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60",
  },
  EVIDENCE_REQUIRED: {
    label: "Evidence required",
    group: "Evidence required",
    hint: "A factual claim that needs a source before it goes out. Costs a few points until a reviewer confirms the evidence is on file; doesn't stop approval.",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    card: "border-sky-500/30 bg-sky-500/5 hover:border-sky-500/60",
  },
  CLEARED: {
    label: "Cleared",
    group: "Cleared by context",
    hint: "The trigger is there, but the wording around it shows the rule doesn't apply.",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    card: "border-border bg-muted/30 hover:border-border",
  },
};

export const FINDING_ORDER: FindingStatus[] = ["VIOLATION", "NEEDS_REVIEW", "EVIDENCE_REQUIRED", "CLEARED"];

/** The findings split by status, each group in the order given. */
export function groupFindings<T>(items: T[], statusFor: (item: T) => FindingStatus): Record<FindingStatus, T[]> {
  const out: Record<FindingStatus, T[]> = { VIOLATION: [], NEEDS_REVIEW: [], EVIDENCE_REQUIRED: [], CLEARED: [] };
  for (const item of items) out[statusFor(item)].push(item);
  return out;
}

export function StatusPill({ status, critical = false }: { status: FindingStatus; critical?: boolean }) {
  const meta = FINDING_META[status];
  const tone = status === "VIOLATION" && !critical ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : meta.pill;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`} title={meta.hint}>
      {status === "VIOLATION" && critical ? "Critical" : meta.label}
    </span>
  );
}

/** How the AI read a finding in context: what it's about, why, and how sure it was. */
export function ContextNote({ v }: { v: Pick<ComplianceViolation, "evaluation"> }) {
  const e = v.evaluation;
  if (!e) return null;
  if (e.source === "UNAVAILABLE") {
    return <p className="text-xs text-muted-foreground">{e.reasoning}</p>;
  }
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-background/60 px-2.5 py-2 text-[13px] text-foreground/85">
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="w-3 h-3" /> Read in context
        {e.subject && <span className="font-medium normal-case tracking-normal">· about {e.subject}</span>}
        <span className="ml-auto font-medium normal-case tracking-normal" title={`Decided by ${e.model ?? "a model"}. Confidence is the model's own estimate.`}>
          {Math.round(e.confidence * 100)}% sure
        </span>
      </p>
      <p>{e.reasoning}</p>
      {e.matched_text && <p className="text-xs text-muted-foreground">Based on: “{e.matched_text}”</p>}
      {e.rule_decision !== e.decision && (
        <p className="text-xs text-muted-foreground">The wording alone would have been a {FINDING_META[e.rule_decision].label.toLowerCase()}.</p>
      )}
    </div>
  );
}

/** A heading with a count for a group of findings; the cleared group folds away. */
export function FindingGroup({
  status,
  count,
  children,
}: {
  status: FindingStatus;
  count: number;
  children: ReactNode;
}) {
  const meta = FINDING_META[status];
  const foldable = status === "CLEARED";
  const [open, setOpen] = useState(!foldable);
  if (!count) return null;
  return (
    <section className="flex flex-col gap-2.5" aria-label={meta.group}>
      <button
        type="button"
        disabled={!foldable}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-left ${foldable ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={open}
      >
        {foldable && (open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />)}
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{meta.group}</span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-foreground/70">{count}</span>
        <span className="hidden text-[11px] text-muted-foreground sm:inline">{foldable || status !== "VIOLATION" ? `· ${meta.hint}` : ""}</span>
      </button>
      {open && children}
    </section>
  );
}

/**
 * The findings that aren't violations, for screens that list violations their own way: what still needs a look or a
 * source, and the triggers the context cleared. Nothing here costs points or stops approval.
 */
export function OtherFindings({ violations, className = "" }: { violations: ComplianceViolation[]; className?: string }) {
  const warnings = violations.filter(isWarning);
  const cleared = violations.filter((v) => statusOf(v) === "CLEARED");
  if (!warnings.length && !cleared.length) return null;
  const row = (v: ComplianceViolation) => (
    <li key={v.rule_id} className="flex flex-col gap-1.5 text-xs">
      <p className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={statusOf(v)} />
        <span className="font-semibold text-foreground">{v.rule_number}</span>
        <span className="text-muted-foreground">· {v.title}</span>
      </p>
      {v.flagged_terms.length > 0 && <p className="text-muted-foreground">{v.flagged_terms.map((t) => `“${t}”`).join(", ")}</p>}
      <ContextNote v={v} />
      {isWarning(v) && v.remediation_guidance && (
        <p className="text-foreground/80">
          <span className="font-semibold">What to check:</span> {v.remediation_guidance}
        </p>
      )}
    </li>
  );
  return (
    <div className={`space-y-3 border-t border-border/60 pt-3 ${className}`}>
      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Check before publishing <span className="font-normal text-muted-foreground">· a claim that needs a source costs a few points until its evidence is confirmed</span>
          </p>
          <ul className="space-y-3">{warnings.map(row)}</ul>
        </div>
      )}
      <FindingGroup status="CLEARED" count={cleared.length}>
        <ul className="space-y-3">{cleared.map(row)}</ul>
      </FindingGroup>
    </div>
  );
}
