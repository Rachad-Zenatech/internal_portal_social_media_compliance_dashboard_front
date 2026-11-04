import { ArrowRight, Check, Highlighter, MessageSquareText } from "lucide-react";

import type { ScriptHighlight } from "@/types/script";

const CARD =
  "flex w-full flex-col gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors hover:border-sky-400/70 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

function Quote({ text, color, strike }: { text: string; color: string; strike?: boolean }) {
  return (
    <span className="flex items-start gap-2">
      <span className="mt-0.5 h-4 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className={`line-clamp-3 rounded-sm px-1 text-[13px] text-foreground ${strike ? "line-through decoration-red-500/70" : ""}`} style={{ backgroundColor: `${color}66` }}>
        “{text}”
      </span>
    </span>
  );
}

function Note({ note }: { note: string }) {
  return note ? (
    <span className="flex items-start gap-1.5 border-t border-border/70 pt-1.5 text-[13px] text-foreground/90">
      <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="whitespace-pre-wrap">{note}</span>
    </span>
  ) : (
    <span className="pl-3.5 text-[11px] text-muted-foreground">Highlight only</span>
  );
}

const byPosition = (list: ScriptHighlight[]) => [...list].sort((a, b) => a.start - b.start);

/**
 * The reviewer's highlights and notes as cards; clicking one takes you to that wording in the script.
 * With `onToggleDone`, each card also has a check button for the creator to mark it fixed.
 */
export default function HighlightCards({
  highlights,
  onPick,
  empty,
  done,
  onToggleDone,
}: {
  highlights: ScriptHighlight[];
  onPick: (id: string) => void;
  empty: string;
  /** Ids the creator has marked done. */
  done?: Set<string>;
  onToggleDone?: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <Highlighter className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <>
      {byPosition(highlights).map((h) => {
        const isDone = done?.has(h.id) ?? false;
        return (
          <div key={h.id} className="relative">
            <button
              type="button"
              onClick={() => onPick(h.id)}
              title="Show in the script"
              className={`${CARD} ${isDone ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5" : "border-border"} ${onToggleDone ? "pr-11" : ""}`}
            >
              <Quote text={h.text} color={h.color} />
              <Note note={h.note} />
            </button>
            {onToggleDone && (
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={isDone ? "Marked done: undo" : "Mark as done"}
                title={isDone ? "Done. Click to undo" : "Mark as done"}
                onClick={() => onToggleDone(h.id)}
                className={`absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full border transition-colors ${
                  isDone
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-border bg-card text-muted-foreground hover:border-emerald-500 hover:text-emerald-600"
                }`}
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

/** What the creator did about the reviewer's earlier highlights: the old wording, an arrow, and the new wording. */
export function AddressedCards({ highlights, onPick }: { highlights: ScriptHighlight[]; onPick: (h: ScriptHighlight) => void }) {
  return (
    <>
      {byPosition(highlights).map((h) => {
        const changed = Boolean(h.done) && h.updated != null && h.updated.trim() !== h.text.trim();
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onPick(h)}
            title="Show in the script"
            className={`${CARD} ${h.done ? "border-emerald-300 dark:border-emerald-500/30" : "border-border"}`}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
              {h.done ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Marked done
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">Not marked done</span>
              )}
            </span>
            {changed ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <Quote text={h.text} color={h.color} strike />
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="changed to" />
                <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[13px] text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">{h.updated?.trim() ? `“${h.updated}”` : "(removed)"}</span>
              </span>
            ) : (
              <Quote text={h.text} color={h.color} />
            )}
            {h.done && !changed && <span className="pl-3.5 text-[11px] text-muted-foreground">Wording unchanged</span>}
            {h.note && <Note note={h.note} />}
          </button>
        );
      })}
    </>
  );
}
