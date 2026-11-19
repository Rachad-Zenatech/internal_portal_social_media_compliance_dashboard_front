import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scriptDocService } from "@/services/scriptDocService";
import type { DefaultScriptTemplate } from "@/types/scriptDoc";

const ACCEPTED = ".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

/** Upload a .docx, .pdf, or .txt script template to replace the default script template used in Share Document. */
export default function DefaultTemplateDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current?: DefaultScriptTemplate;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => scriptDocService.uploadDefaultTemplate(f),
    onSuccess: (next) => {
      queryClient.setQueryData(["script-doc-default-template"], next);
      toast.success(`Default script template updated (${next.headers.length} columns)`);
      setFile(null);
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error((e as { message?: string })?.message ?? "Couldn't upload template"),
  });

  const reset = useMutation({
    mutationFn: () => scriptDocService.resetDefaultTemplate(),
    onSuccess: (next) => {
      queryClient.setQueryData(["script-doc-default-template"], next);
      toast.success("Reset to built-in default template");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error((e as { message?: string })?.message ?? "Couldn't reset template"),
  });

  const busy = upload.isPending || reset.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setFile(null); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Replace default script template</DialogTitle>
          <DialogDescription>
            Upload a Word (.docx), PDF, or text file with a script table. New blank scripts and added pages will use its columns in Share Document.
          </DialogDescription>
        </DialogHeader>

        {current && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="font-medium text-foreground">
              Active template: {current.is_custom && current.filename ? current.filename : "Built-in default"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {current.headers.map((h, i) => (
                <span key={`${h}-${i}`} className="rounded bg-background px-2 py-0.5 text-[11px] text-muted-foreground border">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" className="w-full justify-center gap-2" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose template file (.docx, .pdf, .txt)"}
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {current?.is_custom ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => reset.mutate()} disabled={busy} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" disabled={!file || busy} onClick={() => file && upload.mutate(file)}>
              {upload.isPending ? "Uploading…" : "Save template"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
