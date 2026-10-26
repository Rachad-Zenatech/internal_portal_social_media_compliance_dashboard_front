import type { PublicMood } from "@/types/publicMood";

/** Plain-language signals from the topic numbers, for the perception check. Rules on the data, not AI, so sample
 * data never turns into an AI judgement. */
export function trendSignals(mood?: PublicMood | null): { text: string; tone: "risk" | "good" }[] {
  const out: { text: string; tone: "risk" | "good" }[] = [];
  for (const t of mood?.topics ?? []) {
    const s = t.snapshot;
    if (!s) continue;
    if (s.is_spike && s.negative_pct >= 20) {
      out.push({ text: `${t.name} is spiking with ${s.negative_pct}% negative mentions: expect more attention, and more pushback.`, tone: "risk" });
    } else if (s.negative_pct >= 25) {
      out.push({ text: `${t.name} is drawing criticism online right now (${s.negative_pct}% of mentions negative).`, tone: "risk" });
    } else if (s.is_spike) {
      out.push({ text: `${t.name} is spiking (mentions up ${s.volume_change_pct ?? 0}%): a post on it now gets more attention.`, tone: "good" });
    } else if (s.positive_pct >= 50 && s.negative_pct <= 15) {
      out.push({ text: `${t.name} is mostly positive online (${s.positive_pct}% positive).`, tone: "good" });
    }
  }
  return out;
}
