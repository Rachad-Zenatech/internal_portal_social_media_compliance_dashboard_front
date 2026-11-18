import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ExternalLink, FileText, Link2, Loader2, XCircle } from "lucide-react";

import ClaimVsSource from "@/components/submissions/ClaimVsSource";
import SourceTrustBar from "@/components/submissions/SourceTrustBar";
import { SourceConfirmationsProvider, useSourceCalls } from "@/components/submissions/sourceConfirmationsContext";
import type { SourceCheck, SourceClaim, SourceVerdict } from "@/services/complianceService";
import type { SourceLinkCheck } from "@/types/sourceLink";
import { visibleSourceChecks } from "@/lib/sourceCheckVisibility";

const VERDICT: Record<SourceVerdict, { label: string; tone: string }> = {
  SUPPORTED: { label: "Matches the source", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  CONTRADICTED: { label: "Doesn't match", tone: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  NOT_FOUND: { label: "Not in the source", tone: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
  UNCLEAR: { label: "Unclear", tone: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" },
};

const AUTHORITY: Record<string, string> = {
  OFFICIAL: "Official source",
  COMPANY: "Company site",
  NEWS: "News outlet",
  OTHER: "Other site",
};

const WHERE: Record<SourceCheck["where"], string> = {
  caption: "cited in the caption",
  image: "cited on the image",
  attached: "attached document",
  source_links: "added source link",
  newsroom: "automatic supporting cross-check",
  script: "cited in the script",
};

/** Keep quick checks made from Post details visible when the rulebook response omitted that URL. */
function mergeSourceChecks(checks?: SourceCheck[] | null, savedChecks?: Record<string, SourceLinkCheck>): SourceCheck[] {
  const merged = [...(checks ?? [])];
  const knownUrls = new Set(
    merged
      .filter((check) => check.kind === "URL" && check.where !== "newsroom")
      .flatMap((check) => [check.url, check.reference])
      .filter((url): url is string => Boolean(url))
      .map((url) => url.toLowerCase())
  );

  const checksMap = savedChecks && typeof savedChecks === "object" ? savedChecks : {};
  for (const [url, saved] of Object.entries(checksMap)) {
    if (!saved || knownUrls.has(url.toLowerCase())) continue;
    merged.push({
      ...saved,
      reference: saved.reference || url,
      where: saved.where ?? "caption",
      claims: (saved.claims ?? []).map((claim) => ({
        ...claim,
        where: claim.where ?? "caption",
        confidence: claim.confidence ?? 0,
      })),
    });
  }
  return visibleSourceChecks(merged);
}

function counts(claims: SourceClaim[]) {
  const n = (v: SourceVerdict) => claims.filter((c) => c.verdict === v).length;
  return { ok: n("SUPPORTED"), wrong: n("CONTRADICTED"), open: n("NOT_FOUND") + n("UNCLEAR") };
}

/** The AI's verdict on one claim, then the post's words next to the source's, for the reviewer to confirm. */
function ClaimRow({ claim, sourceUrl, creator }: { claim: SourceClaim; sourceUrl?: string | null; creator: boolean }) {
  const calls = useSourceCalls();
  const url = claim.source_url || sourceUrl;
  const markedAsMatching = creator && url && calls?.mine(url, claim.claim)?.matches === true;
  return (
    <div className={creator ? "space-y-2 rounded-xl border border-border/70 bg-card p-3.5" : "space-y-0.5 rounded-md border border-border/40 p-1.5"}>
      <p className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${VERDICT[claim.verdict].tone}`}>
          {creator ? "" : "AI: "}{VERDICT[claim.verdict].label}
        </span>
        {(creator || claim.where === "image") && <span className="text-xs text-muted-foreground">{claim.where === "image" ? "Image text" : "Post text"}</span>}
      </p>
      {markedAsMatching && (
        <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Check aria-hidden="true" className="size-3.5" /> Marked as matching by you
        </p>
      )}
      <ClaimVsSource item={claim} sourceUrl={sourceUrl} />
      {claim.note && claim.verdict !== "SUPPORTED" && <p className="ml-1 text-foreground/80">{claim.note}</p>}
      {creator && !claim.note && claim.verdict === "NOT_FOUND" && (
        <p className="text-muted-foreground">Add a source that supports this claim or revise the wording.</p>
      )}
    </div>
  );
}

function Row({ source, creator }: { source: SourceCheck; creator: boolean }) {
  const { ok, wrong, open: unsettled } = counts(source.claims);
  const problem = source.status !== "READ";
  const needsLook = problem || wrong > 0 || unsettled > 0;
  const [open, setOpen] = useState(needsLook);
  const name = source.title || source.reference;
  const Icon = problem ? AlertTriangle : wrong > 0 ? XCircle : unsettled > 0 ? AlertTriangle : CheckCircle2;
  const tone = problem || unsettled > 0 ? "text-amber-600" : wrong > 0 ? "text-red-600" : "text-emerald-600";
  const hasDetail = Boolean(source.message) || source.claims.length > 0;
  const primaryClaims = creator ? source.claims.filter((claim) => claim.verdict !== "SUPPORTED") : source.claims;
  const matchedClaims = creator ? source.claims.filter((claim) => claim.verdict === "SUPPORTED") : [];

  return (
    <li className={creator ? "rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4" : "rounded-lg border border-border/60 bg-background/60 px-2.5 py-2"}>
      <div className="flex items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasDetail}
        aria-expanded={hasDetail ? open : undefined}
        className="flex w-full items-start gap-1.5 text-left"
      >
        <Icon className={`mt-px h-3.5 w-3.5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className={creator ? "break-words font-semibold text-foreground" : "block truncate font-semibold text-foreground"} title={source.reference}>
            {name}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {[
              WHERE[source.where],
              source.authority ? AUTHORITY[source.authority] : null,
              source.published ? `published ${source.published.slice(0, 10)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {source.status === "READ" && source.claims.length > 0 && (
            <span className="block text-[11px]">
              {ok > 0 && <span className="text-emerald-700 dark:text-emerald-300">{ok} match{ok === 1 ? "es" : ""}</span>}
              {ok > 0 && (wrong > 0 || unsettled > 0) && " · "}
              {wrong > 0 && <span className="text-red-700 dark:text-red-300">{wrong} don't match</span>}
              {wrong > 0 && unsettled > 0 && " · "}
              {unsettled > 0 && <span className="text-amber-800 dark:text-amber-300">{unsettled} to check</span>}
            </span>
          )}
        </span>
        {hasDetail && <ChevronDown className={`mt-px h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open the source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {open && hasDetail && (
        <div className="mt-1.5 space-y-1.5 border-t border-border/50 pt-1.5">
          {!creator && source.status === "READ" && <SourceTrustBar url={source.url} />}
          {source.message && <p className="text-amber-800 dark:text-amber-300">{source.message}</p>}
          {primaryClaims.map((claim, index) => (
            <ClaimRow key={`${claim.claim}-${index}`} claim={claim} sourceUrl={source.url} creator={creator} />
          ))}
          {matchedClaims.length > 0 && (
            <details className="rounded-lg border border-border/70 bg-background">
              <summary className="cursor-pointer px-3 py-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                {source.where === "newsroom" ? "Supporting evidence" : "Matched claims"} ({matchedClaims.length})
              </summary>
              <div className="space-y-2 px-3 pb-3">
                {matchedClaims.map((claim, index) => <ClaimRow key={`${claim.claim}-${index}`} claim={claim} sourceUrl={source.url} creator />)}
              </div>
            </details>
          )}
          {creator && source.status === "READ" && source.url && (
            <details className="rounded-lg border border-border/70 bg-background">
              <summary className="cursor-pointer px-3 py-2.5 text-muted-foreground">Source ratings</summary>
              <div className="px-3 pb-3"><SourceTrustBar url={source.url} /></div>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

/** Banner shown on the compliance step when a source link or image-source scan is running in the background. */
export function SourceCheckingNotice({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-2.5 text-xs text-foreground dark:border-blue-500/30 dark:bg-blue-500/5">
      <p className="flex items-center gap-2 font-semibold">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
        Checking source in the background
      </p>
      <ul className="mt-1 space-y-0.5 pl-5.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="truncate" title={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Card rendered on the compliance step when source checks exist or a source is being checked in the background. */
export function SourcesCheckedSection({
  checks,
  savedChecks,
  checking,
  submissionId,
  className = "",
}: {
  checks?: SourceCheck[] | null;
  /** Results saved by quick-checking links in Post details. */
  savedChecks?: Record<string, SourceLinkCheck>;
  checking?: string[];
  submissionId?: string | null;
  className?: string;
}) {
  const sourceChecks = mergeSourceChecks(checks, savedChecks);
  if (sourceChecks.length === 0 && (checking?.length ?? 0) === 0) return null;
  return (
    <section className={className}>
      <h2 className="text-lg font-bold text-foreground">Sources checked</h2>
      <SourceCheckingNotice items={checking} />
      <SourceChecks checks={sourceChecks} submissionId={submissionId} creator />
    </section>
  );
}

/**
 * The sources a post cites (links in the caption, "Source:" lines on the image, attached documents), and for each one
 * which of the post's claims it backs up, contradicts or doesn't settle. Nothing shows when the post cites no source.
 */
export default function SourceChecks({
  checks,
  savedChecks,
  submissionId,
  className = "",
  onViewChange,
  creator = false,
}: {
  checks?: SourceCheck[] | null;
  /** Results saved by quick-checking links in Post details. */
  savedChecks?: Record<string, SourceLinkCheck>;
  /** The post: with it, calls on the sources are saved and each source's standing with reviewers is shown. */
  submissionId?: string | null;
  className?: string;
  /** Lets a parent show source checks separately from its compliance findings. */
  onViewChange?: (view: "checks" | "review") => void;
  creator?: boolean;
}) {
  const sourceChecks = mergeSourceChecks(checks, savedChecks);

  const links = sourceChecks.filter((c) => c.kind === "URL").length;
  const needsReview = sourceChecks.filter((source) => {
    const { wrong, open } = counts(source.claims);
    return source.status !== "READ" || wrong > 0 || open > 0;
  });
  const [activeTab, setActiveTab] = useState<"checks" | "review">(
    onViewChange || (creator && needsReview.length > 0) ? "review" : "checks",
  );
  if (sourceChecks.length === 0) return null;
  const visibleChecks = activeTab === "review" ? needsReview : sourceChecks;
  const urls = [...new Set(sourceChecks.flatMap((c) => [c.url, ...c.claims.map((k) => k.source_url)]).filter(Boolean) as string[])];
  return (
    <SourceConfirmationsProvider submissionId={submissionId} urls={urls}>
    <div className={`${creator ? "space-y-3 text-sm" : "space-y-1.5 text-[11px]"} ${className}`}>
      {!creator && <div className="flex items-center gap-1.5 font-semibold text-foreground">
        {links > 0 ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        Sources checked ({sourceChecks.length})
      </div>}
      <div role="tablist" aria-label="Source check results" className="flex gap-1 border-b border-border/60">
        <button type="button" role="tab" aria-selected={activeTab === "review"} onClick={() => { setActiveTab("review"); onViewChange?.("review"); }} className={`border-b-2 px-2 py-1 font-semibold ${activeTab === "review" ? "border-amber-600 text-amber-700 dark:text-amber-300" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          Needs review ({needsReview.length})
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "checks"} onClick={() => { setActiveTab("checks"); onViewChange?.("checks"); }} className={`border-b-2 px-2 py-1 font-semibold ${activeTab === "checks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          {creator ? "All sources" : "Check source"} ({sourceChecks.length})
        </button>
      </div>
      {(!onViewChange || activeTab === "checks") && (visibleChecks.length > 0 ? (
        <ul role="tabpanel" className={creator ? "space-y-3" : "space-y-1.5"}>
          {visibleChecks.map((c, index) => (
            <Row key={`${c.kind}-${c.reference}-${index}`} source={c} creator={creator} />
          ))}
        </ul>
      ) : (
        <p role="tabpanel" className="rounded-lg border border-dashed border-border/60 px-2.5 py-3 text-muted-foreground">All source claims are supported.</p>
      ))}
    </div>
    </SourceConfirmationsProvider>
  );
}
