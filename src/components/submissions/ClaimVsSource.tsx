import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";

import { useSourceCalls } from "@/components/submissions/sourceConfirmationsContext";
import { textFragmentUrl } from "@/lib/textFragment";

/** What both the quick check and the reviewer's view know about a claim. */
export interface ClaimLike {
  claim: string;
  evidence?: string | null;
  source_location?: string | null;
  source_quote?: string | null;
  /** The page the quote is on, when another source than the check's own backed the claim. */
  source_url?: string | null;
}

type Confirmation = "matches" | "differs" | null;

const CONFIRM_BTN = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium";
const CONFIRMED: Record<Exclude<Confirmation, null>, string> = {
  matches: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  differs: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

function SourceWords({ item }: { item: ClaimLike }) {
  if (item.source_quote) {
    return <p className="border-l-2 border-primary/40 pl-2 text-foreground">“{item.source_quote}”</p>;
  }
  if (!item.evidence) return null;
  return (
    <p className="pl-2 text-muted-foreground">
      {item.evidence} <span className="text-[10px] italic">(AI summary: the exact words weren't found)</span>
    </p>
  );
}

function WhereLink({ item, sourceUrl }: { item: ClaimLike; sourceUrl?: string | null }) {
  if (!item.source_location && !sourceUrl) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      {item.source_location && <span>{item.source_location}</span>}
      {sourceUrl && item.source_quote && (
        <a
          href={textFragmentUrl(sourceUrl, item.source_quote)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
        >
          Open at this spot <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </p>
  );
}

function ConfirmButtons({ value, onChange }: { value: Confirmation; onChange: (v: Confirmation) => void }) {
  const button = (v: Exclude<Confirmation, null>, label: string, Icon: typeof Check) => (
    <button
      type="button"
      onClick={() => onChange(value === v ? null : v)}
      aria-pressed={value === v}
      className={`${CONFIRM_BTN} ${value === v ? CONFIRMED[v] : "border-border text-muted-foreground hover:bg-muted"}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">Your read:</span>
      {button("matches", "Matches", Check)}
      {button("differs", "Doesn't match", X)}
    </div>
  );
}

/**
 * What the post says next to what the source says, word for word where it could be found, with a link to that spot in
 * the source and buttons for the reader to record their own read. The verdict above it is the AI's; this is for a person
 * to confirm it.
 */
export default function ClaimVsSource({ item, sourceUrl }: { item: ClaimLike; sourceUrl?: string | null }) {
  const pageUrl = item.source_url || sourceUrl;
  const [confirmed, setConfirmed] = useSavedConfirmation(item, pageUrl);
  const hasSource = Boolean(item.source_quote || item.evidence);
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Post says</p>
      <p className="pl-2 text-foreground">“{item.claim}”</p>
      {hasSource && <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source says</p>}
      <SourceWords item={item} />
      <WhereLink item={item} sourceUrl={pageUrl} />
      {hasSource && <ConfirmButtons value={confirmed} onChange={setConfirmed} />}
      {pageUrl && <ReviewerCalls url={pageUrl} claim={item.claim} />}
    </div>
  );
}

/** The reader's own call on the claim: saved with the post when there is a provider, kept on the page otherwise. */
function useSavedConfirmation(item: ClaimLike, url?: string | null): [Confirmation, (v: Confirmation) => void] {
  const calls = useSourceCalls();
  const [local, setLocal] = useState<Confirmation>(null);
  if (!calls || !url) return [local, setLocal];
  const saved = calls.mine(url, item.claim)?.matches;
  const value: Confirmation = saved === true ? "matches" : saved === false ? "differs" : null;
  const save = (v: Confirmation) =>
    calls.confirm({ url, claim: item.claim, source_quote: item.source_quote, matches: v === null ? null : v === "matches" });
  return [value, save];
}

/** What reviewers (other than the reader) said about this claim against this source. */
function ReviewerCalls({ url, claim }: { url: string; claim: string }) {
  const calls = useSourceCalls();
  const theirs = calls?.reviewers(url, claim) ?? [];
  const yes = theirs.filter((c) => c.matches === true).length;
  const no = theirs.filter((c) => c.matches === false).length;
  if (!yes && !no) return null;
  const said = (n: number, what: string) => `${n} reviewer${n === 1 ? "" : "s"} ${what}`;
  return (
    <p className="text-[10px] font-medium">
      {yes > 0 && <span className="text-emerald-700 dark:text-emerald-300">{said(yes, "confirmed it matches")}</span>}
      {yes > 0 && no > 0 && " · "}
      {no > 0 && <span className="text-red-700 dark:text-red-300">{said(no, "found it doesn't match")}</span>}
    </p>
  );
}
