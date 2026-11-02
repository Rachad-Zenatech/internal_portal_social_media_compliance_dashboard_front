import type { ReactNode } from "react";

import type { DiffPart } from "@/lib/wordDiff";
import type { ScriptStatus } from "@/types/script";

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with the given phrases marked (flagged wording). */
export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map(escapeRe).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-amber-200/80 px-0.5 text-foreground underline decoration-amber-600 decoration-2 underline-offset-2 dark:bg-amber-500/30">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const REMOVED = "rounded-sm bg-red-100 px-0.5 text-red-800 line-through decoration-red-500/70 dark:bg-red-500/20 dark:text-red-300";
const ADDED = "rounded-sm bg-emerald-100 px-0.5 text-emerald-900 no-underline dark:bg-emerald-500/20 dark:text-emerald-200";

/** One version with the other's changes marked in place: removed wording struck through, added wording in green. */
export function InlineDiff({
  parts,
  terms = [],
  focusId,
  onPick,
  numbered = true,
  showChanges = true,
}: {
  parts: DiffPart[];
  /** Flagged wording to mark in the text. */
  terms?: string[];
  focusId?: number | null;
  onPick?: (id: number) => void;
  numbered?: boolean;
  /** Off: just the new version, as clean text. */
  showChanges?: boolean;
}) {
  return (
    <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.85] text-foreground">
      {parts.map((p, k) => {
        if (p.kind === "same") return <Highlighted key={k} text={p.after} terms={terms} />;
        // Changes are numbered in order from 0 (see wordDiff), matching the list beside the script.
        const n = p.id + 1;
        if (!showChanges) return <Highlighted key={k} text={p.added} terms={terms} />;
        const ring = focusId === p.id ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-card" : "";
        return (
          <span
            key={k}
            id={`change-${p.id}`}
            onClick={onPick ? () => onPick(p.id) : undefined}
            className={`scroll-mt-24 rounded-sm ${ring} ${onPick ? "cursor-pointer" : ""}`}
          >
            {p.removed.trim() && <del className={REMOVED}>{p.removed.replace(/\s+$/, "")}</del>}
            {p.removed.trim() && p.added.trim() && " "}
            {p.added.trim() && <ins className={ADDED}>{p.added.replace(/\s+$/, "")}</ins>}
            {numbered && <sup className="ml-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">{n}</sup>}
            {/\s$/.test(p.added || p.removed) ? (p.added || p.removed).match(/\s+$/)?.[0] : ""}
          </span>
        );
      })}
    </div>
  );
}

/** The two versions next to each other: removed wording marked on the left, added wording on the right. */
export function SideBySide({
  parts,
  left,
  right,
  focusId,
  onPick,
}: {
  parts: DiffPart[];
  left: { title: string; sub?: string };
  right: { title: string; sub?: string };
  focusId?: number | null;
  onPick?: (id: number) => void;
}) {
  const column = (side: "before" | "after") =>
    parts.map((p, k) => {
      if (p.kind === "same") return <span key={k}>{side === "before" ? p.before : p.after}</span>;
      const text = side === "before" ? p.removed : p.added;
      if (!text.trim()) return null;
      const ring = focusId === p.id ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-card" : "";
      return (
        <span key={k} onClick={onPick ? () => onPick(p.id) : undefined} className={`${onPick ? "cursor-pointer" : ""}`}>
          <span className={`${side === "before" ? "rounded-sm bg-red-100 px-0.5 text-red-800 dark:bg-red-500/20 dark:text-red-300" : ADDED} ${ring}`}>
            {text.replace(/\s+$/, "")}
          </span>
          {text.match(/\s+$/)?.[0] ?? ""}
        </span>
      );
    });
  const pane = (head: { title: string; sub?: string }, body: ReactNode, tint: string) => (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className={`flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-2.5 ${tint}`}>
        <span className="text-sm font-semibold text-foreground">{head.title}</span>
        {head.sub && <span className="text-xs text-muted-foreground">{head.sub}</span>}
      </header>
      <div className="whitespace-pre-wrap break-words px-5 py-4 text-[14px] leading-[1.8] text-foreground">{body}</div>
    </article>
  );
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pane(left, column("before"), "bg-muted/40")}
      {pane(right, column("after"), "bg-emerald-50/60 dark:bg-emerald-500/5")}
    </div>
  );
}

/** "Removed" / "Added" key for the marks above. */
export function DiffLegend() {
  return (
    <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
      <span className={REMOVED}>removed</span>
      <span className={ADDED}>added</span>
    </span>
  );
}

/** The two stages of a video post, with where this one is. */
export function StageSteps({ status, compact = false }: { status?: ScriptStatus | null; compact?: boolean }) {
  const approved = status === "APPROVED";
  const scriptLabel: Record<ScriptStatus, string> = {
    DRAFT: "Script · not sent yet",
    IN_REVIEW: "Script · with a reviewer",
    EDITS_PROPOSED: "Script · reviewer edited it",
    CHANGES_REQUESTED: "Script · changes requested",
    APPROVED: "Script · approved",
  };
  const creatorTurn = status === "EDITS_PROPOSED" || status === "CHANGES_REQUESTED";
  const first = approved
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
    : creatorTurn
    ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
    : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <ol aria-label="Post stages" className={`flex flex-wrap items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <li className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold ${first}`}>
        <span className="grid h-4 w-4 place-items-center rounded-full bg-current/15 text-[10px]">{approved ? "✓" : "1"}</span>
        {scriptLabel[status ?? "DRAFT"]}
      </li>
      <li aria-hidden className="h-px w-5 bg-border" />
      <li
        className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium ${
          approved ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-muted text-muted-foreground"
        }`}
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-current/15 text-[10px]">2</span>
        {approved ? "Video · ready to upload" : "Video · after the script is approved"}
      </li>
    </ol>
  );
}
