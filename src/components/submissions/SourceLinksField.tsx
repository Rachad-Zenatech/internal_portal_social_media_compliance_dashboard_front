import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Link2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { SourceLinkCheck, SourceLinkClaim } from "@/types/sourceLink";

interface Props {
  links: string[];
  submissionId: string | null;
  ensureSubmissionId: () => Promise<string | null>;
  readOnly?: boolean;
  onChange: (next: string[]) => void;
}

const VERDICT_STYLE: Record<SourceLinkClaim["verdict"], { label: string; cls: string }> = {
  SUPPORTED: { label: "Supported", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  NEEDS_CONTEXT: { label: "Needs context", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  NOT_IN_SOURCE: { label: "Not in source", cls: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
  CONTRADICTS: { label: "Contradicts", cls: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
  UNVERIFIED: { label: "Unverified", cls: "bg-muted text-muted-foreground border-border" },
};

function normalizeDraftUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname.includes(".")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function ClaimResultRow({ item }: { item: SourceLinkClaim }) {
  const badge = VERDICT_STYLE[item.verdict] ?? VERDICT_STYLE.UNVERIFIED;
  return (
    <div className="rounded-md border border-border/70 bg-background/80 p-2 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-medium text-foreground">{item.claim}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      {item.source_location && (
        <p className="mt-1 text-[11px] font-medium text-primary/90">
          Where in source: <span className="font-normal text-foreground">{item.source_location}</span>
        </p>
      )}
      {item.evidence && <p className="mt-1 text-muted-foreground">{item.evidence}</p>}
      {item.note && <p className="mt-0.5 text-amber-700 dark:text-amber-300">{item.note}</p>}
    </div>
  );
}

function SourceLinkRow({
  url,
  result,
  checking,
  readOnly,
  onCheck,
  onRemove,
}: {
  url: string;
  result?: SourceLinkCheck;
  checking: boolean;
  readOnly?: boolean;
  onCheck: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{url}</span>
        </a>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={checking}
            onClick={onCheck}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
            {checking ? "Analyzing..." : "Quick AI check"}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${url}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {result.status === "READ" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span className="font-medium text-foreground">{result.title || result.status}</span>
            {result.published && <span className="text-muted-foreground">({result.published})</span>}
          </div>
          {result.message && <p className="text-[11px] text-muted-foreground">{result.message}</p>}
          {result.status === "READ" && result.claims.length === 0 && !result.message && (
            <p className="text-[11px] text-muted-foreground">
              Source read successfully. No specific claims in the current draft needed verification against this link.
            </p>
          )}
          {result.claims.length > 0 && (
            <div className="space-y-1.5">
              {result.claims.map((c, idx) => (
                <ClaimResultRow key={`${c.claim}-${idx}`} item={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Source links added in Details so creators can quick-check them with AI and include them in compliance runs. */
export default function SourceLinksField({ links, submissionId, ensureSubmissionId, readOnly, onChange }: Props) {
  const [draftUrl, setDraftUrl] = useState("");
  const [checkingUrl, setCheckingUrl] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SourceLinkCheck>>({});

  const addLink = (andCheck = false) => {
    const normalized = normalizeDraftUrl(draftUrl);
    if (!normalized) {
      toast.error("Enter a valid web URL (e.g. https://example.com/report).");
      return;
    }
    const next = links.includes(normalized) ? links : [...links, normalized];
    if (next !== links) onChange(next);
    setDraftUrl("");
    if (andCheck) void runQuickCheck(normalized);
  };

  const runQuickCheck = async (url: string) => {
    setCheckingUrl(url);
    try {
      const id = submissionId ?? (await ensureSubmissionId());
      if (!id) return;
      const res = await submissionService.checkSourceLink(id, url);
      setResults((prev) => ({ ...prev, [url]: res }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyze that source link.");
    } finally {
      setCheckingUrl((cur) => (cur === url ? null : cur));
    }
  };

  const removeLink = (url: string) => {
    onChange(links.filter((item) => item !== url));
    setResults((prev) => {
      const copy = { ...prev };
      delete copy[url];
      return copy;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          Source links
        </div>
        <span className="text-[11px] text-muted-foreground">
          Included in compliance checks; run a quick AI check anytime.
        </span>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink(false);
              }
            }}
            placeholder="https://... (article, filing, or reference URL)"
            className="min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => addLink(false)}
            disabled={!draftUrl.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add link
          </button>
          <button
            type="button"
            onClick={() => addLink(true)}
            disabled={!draftUrl.trim() || checkingUrl !== null}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Add &amp; analyze
          </button>
        </div>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((url) => (
            <SourceLinkRow
              key={url}
              url={url}
              result={results[url]}
              checking={checkingUrl === url}
              readOnly={readOnly}
              onCheck={() => void runQuickCheck(url)}
              onRemove={() => removeLink(url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
