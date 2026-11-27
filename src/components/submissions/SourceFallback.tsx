import { useRef, useState } from "react";
import { toast } from "sonner";
import { submissionService } from "@/services/submissionService";
import { useSourceDocumentStatus } from "@/hooks/useSourceDocumentStatus";

const MAX_PDF_BYTES = 18 * 1024 * 1024;
const MAX_TEXT_CHARS = 250000;

export default function SourceFallback({ submissionId, sourceName, sourceKey = sourceName }: { submissionId: string; sourceName: string; sourceKey?: string }) {
  const [kind, setKind] = useState<"" | "pdf" | "text">("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const storageKey = `source-upload:${submissionId}:${sourceKey}`;
  const legacyKey = `source-upload:${submissionId}:${sourceName}`;
  const [fileId, setFileId] = useState<string | null>(() => sessionStorage.getItem(storageKey) || sessionStorage.getItem(legacyKey));
  const { status, error } = useSourceDocumentStatus(submissionId, fileId);

  const upload = async () => {
    if (kind === "pdf" && !file) {
      setFileError("No file added. Choose a PDF to continue.");
      return;
    }
    if (kind === "pdf" && file && (!file.name.toLowerCase().endsWith(".pdf") || file.size > MAX_PDF_BYTES || !file.size)) {
      setFileError("Choose a non-empty PDF no larger than 18 MB.");
      return;
    }
    if (kind === "text" && text.trim().length < 200) {
      toast.error("Paste at least 200 characters of source text.");
      return;
    }
    const name = (sourceName.replace(/[^a-z0-9 _-]/gi, " ").trim().slice(0, 100) || "Source") + ".txt";
    const document = kind === "pdf" ? file : new File([text], name, { type: "text/plain" });
    if (!document) return;
    setBusy(true);
    try {
      const uploaded = await submissionService.uploadFile(submissionId, "SUPPORTING", document);
      sessionStorage.setItem(storageKey, uploaded.id);
      if (legacyKey !== storageKey) sessionStorage.removeItem(legacyKey);
      setFileId(uploaded.id);
      setFile(null);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the source document.");
    } finally {
      setBusy(false);
    }
  };

  const removeCopy = async () => {
    if (!fileId) return;
    setBusy(true);
    try {
      if (status !== "MISSING") await submissionService.removeFile(submissionId, fileId);
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(legacyKey);
      setFileId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the source copy.");
    } finally { setBusy(false); }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Source text copied.");
    } catch {
      toast.error("Could not copy text. Select it and use the copy shortcut instead.");
    }
  };

  if (fileId) {
    if (status === "COMPLETED") return <div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">Source is ready. Run the compliance check again.</p><button type="button" disabled={busy} onClick={() => void removeCopy()} className="rounded border border-input px-3 py-2 text-sm disabled:opacity-50">{busy ? "Removing..." : "Remove source copy"}</button></div>;
    if (status === "FAILED" || status === "MISSING") return (
      <div role="alert" className="space-y-2 text-sm text-red-700 dark:text-red-300">
        <p>{status === "MISSING" ? "The uploaded source could not be found." : `Could not read the source. ${error || "Try another file."}`}</p>
        <button type="button" className="rounded border border-input px-3 py-2" disabled={busy} onClick={() => void removeCopy()}>Remove source and try again</button>
      </div>
    );
    return <p role="status" className="text-sm text-muted-foreground">{status === "UNKNOWN" ? "Could not check source status. Retrying in the background..." : "Source uploaded. Reading in the background; you can continue working..."}</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-foreground" htmlFor={`source-fallback-${submissionId}-${sourceName}`}>Provide a copy of this source</label>
        {kind === "text" && <button type="button" disabled={!text.trim()} onClick={() => void copyText()} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50">Copy all pasted text</button>}
      </div>
      {kind === "text" && <p className="text-xs text-muted-foreground">On the source page, select all and copy: Windows Ctrl+A, Ctrl+C · Mac ⌘+A, ⌘+C. Then paste here with Ctrl+V or ⌘+V.</p>}
      <select id={`source-fallback-${submissionId}-${sourceName}`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
        <option value="">Choose an option</option><option value="pdf">Upload a PDF</option><option value="text">Paste full text</option>
      </select>
      {kind === "pdf" && (
        <div className="space-y-1">
          <input ref={fileInput} aria-label="Source PDF" type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setFileError(""); }} />
          <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">Choose file</button>
          <span className="ml-2 text-xs text-muted-foreground">{file?.name || "No file selected"}</span>
          {fileError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{fileError}</p>}
        </div>
      )}
      {kind === "text" && <textarea aria-label="Full source text" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT_CHARS} rows={7} placeholder="Paste the full source text" className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />}
      {kind && <button type="button" disabled={busy} onClick={() => void upload()} className="inline-flex items-center rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy ? "Uploading source..." : "Add source"}</button>}
    </div>
  );
}
