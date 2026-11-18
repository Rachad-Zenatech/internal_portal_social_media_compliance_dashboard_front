import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captionTextId } from "@/lib/captionNote";

/** Full caption text, shared by the creator's conversation and revision workspace. */
export default function ReviewCaptionPreview({ submissionId, caption, onEdit }: {
  submissionId: string;
  caption: string;
  onEdit?: () => void;
}) {
  return (
    <section aria-label="Caption / copy" className="space-y-1.5 rounded-lg border border-border/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">Caption / copy</h3>
        {onEdit && <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onEdit}><PenLine className="size-3.5" /> Edit caption</Button>}
      </div>
      <p id={captionTextId(submissionId)} className="whitespace-pre-wrap break-words text-sm text-foreground">
        {caption.trim() ? caption : <span className="text-muted-foreground">No caption.</span>}
      </p>
    </section>
  );
}
