import type { ReactNode } from "react";

export type GlanceTone = "ok" | "warn" | "bad" | "muted";

export interface GlanceTile {
  key: string;
  label: string;
  /** The one thing to know at a glance: a score, a verdict, a count. */
  value: ReactNode;
  /** A short line under it. */
  sub: string;
  tone: GlanceTone;
  /** The reviewer has opened it. */
  seen: boolean;
}

const TONE: Record<GlanceTone, { value: string; ring: string }> = {
  ok: { value: "text-emerald-700 dark:text-emerald-300", ring: "border-emerald-300/70 dark:border-emerald-500/40" },
  warn: { value: "text-amber-700 dark:text-amber-300", ring: "border-amber-300/70 dark:border-amber-500/40" },
  bad: { value: "text-red-700 dark:text-red-300", ring: "border-red-300/70 dark:border-red-500/40" },
  muted: { value: "text-foreground", ring: "border-border" },
};

/**
 * What a reviewer needs to look at, as four tiles: each says the one thing to know and opens its details below.
 * They replace a plain row of tabs, so one glance shows where the post stands and what is still to look at.
 */
export default function ReviewGlance({
  tiles,
  active,
  onPick,
  extra,
}: {
  tiles: GlanceTile[];
  active: string;
  onPick: (key: string) => void;
  /** Smaller links beside the tiles, such as a video's transcript. */
  extra?: { key: string; label: string }[];
}) {
  const seenCount = tiles.filter((t) => t.seen).length;
  return (
    <div className="border-b border-border/70 px-3 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="text-xs font-semibold text-foreground">Look at</span>
        <span className="text-[11px] text-muted-foreground" aria-live="polite">
          {seenCount === tiles.length ? "All looked at" : `${seenCount} of ${tiles.length} looked at`}
        </span>
      </div>
      <div role="tablist" aria-label="Review sections" className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onPick(t.key)}
              className={`relative flex min-w-0 flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                on ? `${TONE[t.tone].ring} bg-muted/50 shadow-xs` : "border-border/70 bg-card hover:bg-muted/40"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</span>
                {!t.seen && <span className="h-2 w-2 rounded-full bg-blue-500" title="Not looked at yet" />}
              </span>
              <span className={`max-w-full truncate text-lg font-bold leading-tight ${TONE[t.tone].value}`}>{t.value}</span>
              <span className="max-w-full truncate text-xs text-muted-foreground">{t.sub}</span>
            </button>
          );
        })}
      </div>
      {extra && extra.length > 0 && (
        <div className="mt-2 flex gap-3 px-1">
          {extra.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => onPick(e.key)}
              className={`text-xs font-medium hover:underline ${active === e.key ? "text-foreground underline" : "text-muted-foreground"}`}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
