import { useRef, useState, type DragEvent } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,.doc,.txt,.md";
const MAX_MB = 10;

export default function ScriptUploadDropzone({ file, busy, onFile, onError }: {
  file: File | null;
  busy: boolean;
  onFile: (file: File | null) => void;
  onError: (error: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const selectFiles = (files: FileList) => {
    if (busy || !files.length) return;
    const selected = files[0];
    let error: string | null = null;
    if (files.length !== 1) error = "Choose one document. It can contain several scripts.";
    else if (!/\.(pdf|docx?|txt|md)$/i.test(selected.name)) error = "Choose a PDF, Word or text document.";
    else if (selected.size > MAX_MB * 1024 * 1024) error = `That file is too large (${MAX_MB} MB at most).`;
    onError(error);
    onFile(error ? null : selected);
  };
  const enter = (event: DragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const over = (event: DragEvent<HTMLButtonElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = busy ? "none" : "copy";
  };
  const leave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    selectFiles(event.dataTransfer.files);
  };
  const label = dragging ? "Drop your script here" : file?.name ?? "Choose a file or drag it here";

  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        onDragEnter={enter} onDragOver={over} onDragLeave={leave} onDrop={drop}
        className={cn("flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60",
          dragging && "border-primary bg-primary/10 ring-2 ring-primary/20")}
      >
        {file ? <FileText className="h-7 w-7 text-blue-700" /> : <UploadCloud className="h-7 w-7 text-muted-foreground" />}
        <span className="max-w-full break-all text-sm font-medium" aria-live="polite">{label}</span>
        <span className="text-xs text-muted-foreground">PDF, Word or text, up to {MAX_MB} MB</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} disabled={busy} className="hidden"
        onChange={(event) => {
          if (event.target.files) selectFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );
}
