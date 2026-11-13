import { ChevronDown, ImagePlus, Loader2, Upload } from "lucide-react";
import type { RefObject } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SubmissionFile } from "@/types/submission";

interface Props {
  busy: boolean;
  scanningImage: boolean;
  uploadedImages: SubmissionFile[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onScanUploaded: (fileId?: string) => void;
}

export default function ScanImageButton({
  busy,
  scanningImage,
  uploadedImages,
  fileInputRef,
  onScanUploaded,
}: Props) {
  if (uploadedImages.length === 0) {
    return (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        title="Scan an image for a cited source (URL or title + date), find it online, and scrape it"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
      >
        {scanningImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 text-primary" />}
        {scanningImage ? "Scanning..." : "Scan image"}
      </button>
    );
  }

  if (uploadedImages.length === 1) {
    const single = uploadedImages[0];
    return (
      <div className="inline-flex items-center rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => onScanUploaded(single.id)}
          disabled={busy}
          title={`Scan uploaded image "${single.original_name}" for cited sources`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 rounded-l-lg"
        >
          {scanningImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 text-primary" />}
          {scanningImage ? "Scanning..." : "Scan image"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={busy}
              aria-label="More image scan options"
              className="border-l border-border px-1.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 rounded-r-lg"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => onScanUploaded(single.id)}>
              <ImagePlus className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Scan uploaded: {single.original_name}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              Scan another image from computer...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          title="Scan one of the uploaded images or choose a file"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {scanningImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 text-primary" />}
          {scanningImage ? "Scanning..." : "Scan image"}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="text-xs max-w-xs">
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          Uploaded images ({uploadedImages.length})
        </div>
        {uploadedImages.map((img) => (
          <DropdownMenuItem key={img.id} onClick={() => onScanUploaded(img.id)}>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{img.original_name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
          Scan another image from computer...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

