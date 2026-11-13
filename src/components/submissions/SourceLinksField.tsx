import { useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import PastedArticleCheck from "@/components/submissions/PastedArticleCheck";
import ScanImageButton from "@/components/submissions/ScanImageButton";
import SourceCheckResult from "@/components/submissions/SourceCheckResult";
import { SourceConfirmationsProvider } from "@/components/submissions/sourceConfirmationsContext";
import { submissionService } from "@/services/submissionService";
import type { ImageSourceScanJob, SourceLinkCheck } from "@/types/sourceLink";
import type { SubmissionFile } from "@/types/submission";

interface Props {
  links: string[];
  submissionId: string | null;
  ensureSubmissionId: () => Promise<string | null>;
  readOnly?: boolean;
  onChange: (next: string[]) => void;
  uploadedFiles?: SubmissionFile[];
}

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

      {result && <SourceCheckResult result={result} />}
    </div>
  );
}

function SourceLinkInputBar({
  draftUrl,
  busy,
  scanningImage,
  fileInputRef,
  uploadedImages,
  onDraftChange,
  onAdd,
  onPickImage,
  onScanUploaded,
}: {
  draftUrl: string;
  busy: boolean;
  scanningImage: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploadedImages: SubmissionFile[];
  onDraftChange: (v: string) => void;
  onAdd: (analyze: boolean) => void;
  onPickImage: (f: File) => void;
  onScanUploaded: (fileId?: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="url"
        value={draftUrl}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd(false);
          }
        }}
        placeholder="https://... (article, filing, or reference URL)"
        className="min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="button"
        onClick={() => onAdd(false)}
        disabled={!draftUrl.trim()}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
      <button
        type="button"
        onClick={() => onAdd(true)}
        disabled={!draftUrl.trim() || busy}
        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5" /> Add &amp; analyze
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickImage(f);
        }}
      />
      <ScanImageButton
        busy={busy}
        scanningImage={scanningImage}
        uploadedImages={uploadedImages}
        fileInputRef={fileInputRef}
        onScanUploaded={onScanUploaded}
      />
    </div>
  );
}

/** Source links added in Details so creators can quick-check them with AI and include them in compliance runs. */
export default function SourceLinksField({
  links,
  submissionId,
  ensureSubmissionId,
  readOnly,
  onChange,
  uploadedFiles,
}: Props) {
  const [draftUrl, setDraftUrl] = useState("");
  const [checkingUrl, setCheckingUrl] = useState<string | null>(null);
  const [scanningImage, setScanningImage] = useState(false);
  const [scanResult, setScanResult] = useState<ImageSourceScanJob | null>(null);
  const [results, setResults] = useState<Record<string, SourceLinkCheck>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const linksRef = useRef(links);
  linksRef.current = links;

  const uploadedImages = (uploadedFiles ?? []).filter(
    (f) =>
      f.mime_type?.startsWith("image/") ||
      f.kind === "IMAGE" ||
      (f.kind === "MAIN" && !/\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(f.original_name))
  );

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

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

  const pollScanJob = (id: string, jobId: string) => {
    pollTimerRef.current = window.setTimeout(async () => {
      try {
        const job = await submissionService.getImageSourceScanJob(id, jobId);
        if (job.status === "PROCESSING") {
          pollScanJob(id, jobId);
          return;
        }
        setScanResult(job);
        setScanningImage(false);
        if (job.status === "FAILED") {
          toast.error(job.message || "Image source scan failed.");
          return;
        }
        if (job.resolved_url) {
          const cur = linksRef.current;
          const next = cur.includes(job.resolved_url) ? cur : [...cur, job.resolved_url];
          if (next !== cur) onChange(next);
          if (job.check) {
            setResults((prev) => ({ ...prev, [job.resolved_url!]: job.check! }));
          }
          toast.success("Found and scraped source from image.");
        } else if (job.message) {
          toast.info(job.message);
        }
      } catch (err) {
        setScanningImage(false);
        toast.error(err instanceof Error ? err.message : "Could not check image source scan status.");
      }
    }, 1500);
  };

  const runImageScan = async (file?: File, fileId?: string) => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setScanningImage(true);
    setScanResult(null);
    try {
      const id = submissionId ?? (await ensureSubmissionId());
      if (!id) {
        setScanningImage(false);
        return;
      }
      const job = await submissionService.scanImageForSources(id, file, fileId);
      if (job.status === "PROCESSING") {
        toast.info("Scanning image and scraping source in the background...");
        pollScanJob(id, job.job_id);
      } else {
        setScanResult(job);
        setScanningImage(false);
      }
    } catch (err) {
      setScanningImage(false);
      toast.error(err instanceof Error ? err.message : "Could not start image source scan.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    <SourceConfirmationsProvider submissionId={submissionId} urls={links}>
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
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
        <SourceLinkInputBar
          draftUrl={draftUrl}
          busy={checkingUrl !== null}
          scanningImage={scanningImage}
          fileInputRef={fileInputRef}
          uploadedImages={uploadedImages}
          onDraftChange={setDraftUrl}
          onAdd={addLink}
          onPickImage={(f) => void runImageScan(f)}
          onScanUploaded={(fid) => void runImageScan(undefined, fid)}
        />
      )}

      {!readOnly && <PastedArticleCheck submissionId={submissionId} ensureSubmissionId={ensureSubmissionId} />}

      {scanResult && !scanResult.resolved_url && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-foreground">
          {scanResult.citations.length > 0 && (
            <p className="font-medium">
              Extracted source: <span className="font-normal">{scanResult.citations.map((c) => c.reference).join(" • ")}</span>
            </p>
          )}
          {scanResult.message && <p className="mt-0.5 text-muted-foreground">{scanResult.message}</p>}
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
    </SourceConfirmationsProvider>
  );
}
