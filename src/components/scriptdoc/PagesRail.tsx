import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FilePlus2, FileText, Loader2, Send, UploadCloud } from "lucide-react";

import DeleteScriptMenu from "@/components/scriptdoc/DeleteScriptMenu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DocDetail, DocPage, DocStatus } from "@/types/scriptDoc";

const DOT: Record<DocStatus, string> = {
  DRAFT: "bg-muted-foreground/40",
  IN_REVIEW: "bg-blue-500",
  LEVEL2_REVIEW: "bg-violet-500",
  CHANGES_REQUESTED: "bg-amber-500",
  APPROVED: "bg-emerald-500",
};
const LABEL: Record<DocStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  LEVEL2_REVIEW: "Level 2",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
};

export const sendable = (p: DocPage) => p.status === "DRAFT" || p.status === "CHANGES_REQUESTED";

const ACCEPT = ".pdf,.docx,.doc,.txt,.md";
const MAX_MB = 10;

/** Upload a file with one script or several: it is split into scripts, each added as its own page. */
export function UploadPagesDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setFile(null);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const go = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That file couldn't be read.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload script</DialogTitle>
          <DialogDescription>
            Upload a document with one script or several. It is split into separate scripts ("Script 1", headings, dividers) and each is
            added as its own page, with its table, to edit and send for review on its own.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center hover:bg-muted/40"
        >
          {file ? <FileText className="h-7 w-7 text-blue-700" /> : <UploadCloud className="h-7 w-7 text-muted-foreground" />}
          <span className="text-sm font-medium">{file ? file.name : "Choose a file"}</span>
          <span className="text-xs text-muted-foreground">PDF, Word or text, up to {MAX_MB} MB</span>
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > MAX_MB * 1024 * 1024) setError(`That file is too large (${MAX_MB} MB at most).`);
            else {
              setError(null);
              setFile(f);
            }
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!file || busy} onClick={go}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Upload and split
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The pages of the creator's document: every script on its own page. Pick a page to edit it; add a page (a new script with
 * its own table), upload a file that is split into pages, send one page for review (from its header) or all that can be sent.
 */
export default function PagesRail({
  doc,
  busy,
  onAdd,
  onSendAll,
  onDeletePage,
  sendDisabledReason,
}: {
  doc: DocDetail;
  busy: boolean;
  onAdd: () => void;
  onSendAll: () => void;
  onDeletePage: (page: DocPage) => Promise<void>;
  /** Set while sending is off (the details aren't filled in): why. */
  sendDisabledReason?: string;
}) {
  const canSend = doc.access.role === "CREATOR" ? doc.pages.filter(sendable).length : 0;
  const mine = doc.access.role === "CREATOR";
  return (
    <aside className="flex w-full shrink-0 flex-col border-b bg-background lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={doc.set_title ?? undefined}>
          {doc.set_title ?? "Pages"}
        </p>
        <span className="text-xs text-muted-foreground">{doc.pages.length} page{doc.pages.length === 1 ? "" : "s"}</span>
      </div>
      {mine && (
        <div className="border-b p-2">
          <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={onAdd}>
            <FilePlus2 className="mr-1 h-4 w-4" />
            Add script
          </Button>
        </div>
      )}
      <ol className="flex gap-2 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible">
        {doc.pages.map((p, i) => (
          <li key={p.id} className="relative min-w-44 lg:min-w-0">
            {mine && p.status === "DRAFT" && (
              <DeleteScriptMenu className="absolute right-1 top-1.5 z-10 h-6 w-6" name={p.title} onDelete={() => onDeletePage(p)} />
            )}
            <Link
              to={`/script-docs/${p.id}`}
              aria-current={p.id === doc.id ? "page" : undefined}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors",
                p.id === doc.id ? "border-blue-400 bg-blue-50 dark:bg-blue-500/10" : "border-transparent hover:bg-muted/60",
              )}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-medium">{i + 1}</span>
              <span className="min-w-0 flex-1 pr-5">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", DOT[p.status])} />
                  {LABEL[p.status]}
                  {p.status === "IN_REVIEW" && p.required > 0 && ` · ${p.checked_in}/${p.required}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {mine && (
        <div className="border-t p-2">
          <Button
            size="sm"
            className="w-full"
            disabled={busy || canSend === 0 || Boolean(sendDisabledReason)}
            onClick={onSendAll}
            title={sendDisabledReason ?? (canSend === 0 ? "Every page has been sent" : undefined)}
          >
            <Send className="mr-1.5 h-4 w-4" />
            Send {canSend > 1 ? `all ${canSend} ` : canSend === 1 ? "the page " : ""}for review
          </Button>
        </div>
      )}
    </aside>
  );
}
