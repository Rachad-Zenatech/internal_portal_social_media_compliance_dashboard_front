import { Flame } from "lucide-react";

import type { TopicSnapshot } from "@/types/publicMood";

/** Mentions per day over the window, as a tiny line. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - (v / max) * 16}`).join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-16 shrink-0 text-muted-foreground" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Positive / neutral / negative share of mentions. */
export function MoodBar({ s }: { s: Pick<TopicSnapshot, "positive_pct" | "neutral_pct" | "negative_pct"> }) {
  return (
    <div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${s.positive_pct}% positive, ${s.neutral_pct}% neutral, ${s.negative_pct}% negative`}
      >
        <span className="bg-emerald-500" style={{ width: `${s.positive_pct}%` }} />
        <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${s.neutral_pct}%` }} />
        <span className="bg-red-500" style={{ width: `${s.negative_pct}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span className="text-emerald-700 dark:text-emerald-300">{s.positive_pct}% positive</span>
        <span>{s.neutral_pct}% neutral</span>
        <span className="text-red-700 dark:text-red-300">{s.negative_pct}% negative</span>
      </p>
    </div>
  );
}

export function SpikeBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-orange-500/10 px-1.5 py-px text-[9px] font-bold uppercase text-orange-700 dark:text-orange-300">
      <Flame className="w-2.5 h-2.5" /> Spiking
    </span>
  );
}
