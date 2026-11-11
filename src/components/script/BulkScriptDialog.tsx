import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { scriptBatchService } from "@/services/scriptBatchService";

const ACCEPT = ".pdf,.docx,.doc,.txt,.md";
const MAX_MB = 10;

/**
 * Upload one document that holds several scripts. It is split into scripts (by "Script 1", headings, dividers...), and
 * the creator checks the split, fills in the details every post will share, and sends the batch for review.
 */
export default function BulkScriptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setError(null);
      setUploading(false);
      setDragging(false);
    }
  }, [open]);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`That file is too large (${MAX_MB} MB at most).`);
      return;
    }
    setFile(picked);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const batch = await scriptBatchService.upload(file);
      queryClient.invalidateQueries({ queryKey: ["script-batches"] });
      toast.success(`Found ${batch.items.length} script${batch.items.length === 1 ? "" : "s"}. Check them, then send them for review.`);
      onOpenChange(false);
      navigate(`/script-batches/${batch.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That file couldn't be read.");
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload several scripts</DialogTitle>
          <DialogDescription>
            Upload one document that holds all your scripts. We split it into separate scripts for you to check, then a reviewer
            reviews them together, and each approved script becomes its own post for you to film.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10" : "border-border hover:bg-muted/40"
          )}
        >
          {file ? (
            <>
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-medium text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">Click to choose a different file</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Drop a document here, or click to choose one</span>
              <span className="text-xs text-muted-foreground">PDF, Word (.docx) or text, up to {MAX_MB} MB</span>
            </>
          )}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

        <p className="text-xs text-muted-foreground">
          Separate your scripts with a line like <span className="font-medium">Script 1: Title</span>, a heading, or a line of dashes
          (<span className="font-mono">---</span>). You can rename, edit, add or remove scripts after the upload.
        </p>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button type="button" onClick={upload} disabled={!file || uploading} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Reading the scripts" : "Split into scripts"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
