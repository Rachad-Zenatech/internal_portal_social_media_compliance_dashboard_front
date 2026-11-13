import { ShieldAlert, ShieldCheck, ShieldQuestion, ThumbsDown, ThumbsUp } from "lucide-react";

import { useSourceCalls } from "@/components/submissions/sourceConfirmationsContext";

const LEVEL = {
  TRUSTED: { label: "Trusted source", Icon: ShieldCheck, cls: "text-emerald-700 dark:text-emerald-300" },
  UNRATED: { label: "Not rated yet", Icon: ShieldQuestion, cls: "text-muted-foreground" },
  FLAGGED: { label: "Flagged by reviewers", Icon: ShieldAlert, cls: "text-red-700 dark:text-red-300" },
} as const;

const RATE_BTN = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium disabled:opacity-50";

/**
 * A source's standing with reviewers (from every post checked against its site), and buttons to rate it a good or a
 * poor source. Everyone can rate; reviewers' ratings are the ones that count, and the hint says so.
 */
export default function SourceTrustBar({ url }: { url?: string | null }) {
  const calls = useSourceCalls();
  if (!calls || !url) return null;
  const trust = calls.trust(url);
  const level = LEVEL[trust?.level ?? "UNRATED"];
  const mine = calls.mine(url)?.good_source;
  const rate = (good: boolean) => calls.confirm({ url, good_source: mine === good ? null : good });
  const style = (on: boolean, tone: string) => (on ? tone : "border-border text-muted-foreground hover:bg-muted");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
      <span className={`inline-flex items-center gap-1 font-semibold ${level.cls}`} title={trust?.message}>
        <level.Icon className="h-3.5 w-3.5" /> {level.label}
      </span>
      {trust?.message && <span className="text-muted-foreground">{trust.message}</span>}
      <span className="ml-auto inline-flex items-center gap-1">
        <button type="button" disabled={calls.saving} onClick={() => rate(true)} aria-pressed={mine === true}
          className={`${RATE_BTN} ${style(mine === true, "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}`}>
          <ThumbsUp className="h-3 w-3" /> Good source
        </button>
        <button type="button" disabled={calls.saving} onClick={() => rate(false)} aria-pressed={mine === false}
          className={`${RATE_BTN} ${style(mine === false, "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300")}`}>
          <ThumbsDown className="h-3 w-3" /> Poor source
        </button>
      </span>
      {!calls.countsTowardTrust && (
        <span className="w-full text-muted-foreground">
          Your rating is saved with this post; the ratings of the reviewers and approvers deciding on posts set the site's standing.
        </span>
      )}
    </div>
  );
}
