import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, FileText, Link2, XCircle } from "lucide-react";

import ClaimVsSource from "@/components/submissions/ClaimVsSource";
import SourceTrustBar from "@/components/submissions/SourceTrustBar";
import { SourceConfirmationsProvider } from "@/components/submissions/sourceConfirmationsContext";
import type { SourceCheck, SourceClaim, SourceVerdict } from "@/services/complianceService";

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
};

function counts(claims: SourceClaim[]) {
  const n = (v: SourceVerdict) => claims.filter((c) => c.verdict === v).length;
  return { ok: n("SUPPORTED"), wrong: n("CONTRADICTED"), open: n("NOT_FOUND") + n("UNCLEAR") };
}

/** The AI's verdict on one claim, then the post's words next to the source's, for the reviewer to confirm. */
function ClaimRow({ claim, sourceUrl }: { claim: SourceClaim; sourceUrl?: string | null }) {
  return (
    <div className="space-y-0.5 rounded-md border border-border/40 p-1.5">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${VERDICT[claim.verdict].tone}`}>
          AI: {VERDICT[claim.verdict].label}
        </span>
        {claim.where === "image" && <span className="text-[10px] text-muted-foreground">(on the image)</span>}
      </p>
      <ClaimVsSource item={claim} sourceUrl={sourceUrl} />
      {claim.note && claim.verdict !== "SUPPORTED" && <p className="ml-1 text-foreground/80">{claim.note}</p>}
    </div>
  );
}

function Row({ source }: { source: SourceCheck }) {
  const { ok, wrong, open: unsettled } = counts(source.claims);
  const problem = source.status !== "READ";
  const needsLook = problem || wrong > 0 || unsettled > 0;
  const [open, setOpen] = useState(needsLook);
  const name = source.title || source.reference;
  const Icon = problem ? AlertTriangle : wrong > 0 ? XCircle : unsettled > 0 ? AlertTriangle : CheckCircle2;
  const tone = problem || unsettled > 0 ? "text-amber-600" : wrong > 0 ? "text-red-600" : "text-emerald-600";
  const hasDetail = Boolean(source.message) || source.claims.length > 0;

  return (
    <li className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-1.5 text-left"
      >
        <Icon className={`mt-px h-3.5 w-3.5 shrink-0 ${tone}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-foreground" title={source.reference}>
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
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-px shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Open the source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {hasDetail && <ChevronDown className={`mt-px h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && hasDetail && (
        <div className="mt-1.5 space-y-1.5 border-t border-border/50 pt-1.5">
          {source.status === "READ" && <SourceTrustBar url={source.url} />}
          {source.message && <p className="text-amber-800 dark:text-amber-300">{source.message}</p>}
          {source.claims.map((c, i) => (
            <ClaimRow key={`${c.claim}-${i}`} claim={c} sourceUrl={source.url} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The sources a post cites (links in the caption, "Source:" lines on the image, attached documents), and for each one
 * which of the post's claims it backs up, contradicts or doesn't settle. Nothing shows when the post cites no source.
 */
export default function SourceChecks({
  checks,
  submissionId,
  className = "",
}: {
  checks?: SourceCheck[] | null;
  /** The post: with it, calls on the sources are saved and each source's standing with reviewers is shown. */
  submissionId?: string | null;
  className?: string;
}) {
  if (!checks || checks.length === 0) return null;
  const links = checks.filter((c) => c.kind === "URL").length;
  const urls = [...new Set(checks.flatMap((c) => [c.url, ...c.claims.map((k) => k.source_url)]).filter(Boolean) as string[])];
  return (
    <SourceConfirmationsProvider submissionId={submissionId} urls={urls}>
    <div className={`space-y-1.5 text-[11px] ${className}`}>
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        {links > 0 ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
        Sources checked ({checks.length})
      </p>
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <Row key={`${c.kind}-${c.reference}`} source={c} />
        ))}
      </ul>
    </div>
    </SourceConfirmationsProvider>
  );
}
