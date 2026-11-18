import { Check } from "lucide-react";
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
  /** Retained for callers; review navigation uses one consistent visual style. */
  highlight?: boolean;
}

function ReviewSectionTab({ tile, active, onPick }: { tile: GlanceTile; active: string; onPick: (key: string) => void }) {
  const selected = tile.key === active;
  const tone = selected ? "border-primary bg-muted/60 ring-1 ring-primary/15" : "border-border bg-background hover:bg-muted/40";
  return (
    <button type="button" role="tab" aria-selected={selected} onClick={() => onPick(tile.key)}
      className={`flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring last:odd:col-span-2 ${tone}`}>
      <span className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        {tile.label}
        {tile.seen && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
      </span>
      <span className="max-w-full truncate text-sm font-semibold text-foreground">{tile.value}</span>
      <span className="max-w-full truncate text-[11px] leading-relaxed text-muted-foreground">{tile.sub}</span>
    </button>
  );
}

/** Consistent, neutral navigation keeps the review sections easy to scan. */
export default function ReviewGlance({ tiles, active, onPick, extra }: {
  tiles: GlanceTile[];
  active: string;
  onPick: (key: string) => void;
  extra?: { key: string; label: string }[];
}) {
  const seenCount = tiles.filter((tile) => tile.seen).length;
  const extraTiles: GlanceTile[] = (extra ?? []).map((item) => ({ ...item, value: "Open transcript", sub: "Read the video's wording", tone: "muted", seen: item.key === active }));
  const sections = [...tiles, ...extraTiles];
  return (
    <div className="shrink-0 border-b border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Review sections</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">{seenCount} of {tiles.length} opened</span>
      </div>
      <div role="tablist" aria-label="Review sections" className="grid grid-cols-2 gap-2">
        {sections.map((tile) => <ReviewSectionTab key={tile.key} tile={tile} active={active} onPick={onPick} />)}
      </div>
    </div>
  );
}
