import { AlertCircle, CheckCircle2 } from "lucide-react";

import ClaimVsSource from "@/components/submissions/ClaimVsSource";
import SourceTrustBar from "@/components/submissions/SourceTrustBar";
import type { SourceLinkCheck, SourceLinkClaim } from "@/types/sourceLink";

const RED = "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
const AMBER = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";

/** The verdicts the server's source check gives (see the backend's source_check_service). */
const VERDICT_STYLE: Record<SourceLinkClaim["verdict"], { label: string; cls: string }> = {
  SUPPORTED: { label: "Supported", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  CONTRADICTED: { label: "Contradicted", cls: RED },
  NOT_FOUND: { label: "Not in source", cls: AMBER },
  UNCLEAR: { label: "Unclear", cls: "bg-muted text-muted-foreground border-border" },
};

/** One claim from the post next to what the source says, with the AI's verdict and a link to that spot in the source. */
export function ClaimResultRow({ item, sourceUrl }: { item: SourceLinkClaim; sourceUrl?: string | null }) {
  const badge = VERDICT_STYLE[item.verdict] ?? VERDICT_STYLE.UNCLEAR;
  return (
    <div className="rounded-md border border-border/70 bg-background/80 p-2 text-[11px]">
      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}>
        AI: {badge.label}
      </span>
      <ClaimVsSource item={item} sourceUrl={sourceUrl} />
      {item.note && <p className="mt-1 text-amber-700 dark:text-amber-300">{item.note}</p>}
    </div>
  );
}

function ResultHeading({ result }: { result: SourceLinkCheck }) {
  const Icon = result.status === "READ" ? CheckCircle2 : AlertCircle;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <Icon className={`h-3.5 w-3.5 ${result.status === "READ" ? "text-emerald-600" : "text-amber-600"}`} />
      <span className="font-medium text-foreground">{result.title || result.status}</span>
      {result.published && <span className="text-muted-foreground">({result.published})</span>}
    </div>
  );
}

/** What checking one source showed: its title, any message, and each claim's verdict. */
export default function SourceCheckResult({ result }: { result: SourceLinkCheck }) {
  const readWithNothingToCheck = result.status === "READ" && result.claims.length === 0 && !result.message;
  return (
    <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
      <ResultHeading result={result} />
      {result.status === "READ" && <SourceTrustBar url={result.url} />}
      {result.message && <p className="text-[11px] text-muted-foreground">{result.message}</p>}
      {readWithNothingToCheck && (
        <p className="text-[11px] text-muted-foreground">
          Source read successfully. No specific claims in the current draft needed verification against this source.
        </p>
      )}
      {result.claims.length > 0 && (
        <div className="space-y-1.5">
          {result.claims.map((c, idx) => (
            <ClaimResultRow key={`${c.claim}-${idx}`} item={c} sourceUrl={result.url} />
          ))}
        </div>
      )}
    </div>
  );
}
