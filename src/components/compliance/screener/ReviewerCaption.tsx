import type { ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CaptionNoteDialog from "@/components/compliance/screener/CaptionNoteDialog";
import { useCaptionNote } from "@/hooks/useCaptionNote";
import { captionTextId } from "@/lib/captionNote";

export default function ReviewerCaption({ submissionId, canComment, hasCaption, onSaved, children }: {
  submissionId: string;
  canComment: boolean;
  hasCaption: boolean;
  onSaved: (id: string) => void;
  children: ReactNode;
}) {
  const { contentRef, quote, note, setNote, open, onOpenChange, captureSelection, onCaptionClick, save, saving } = useCaptionNote(submissionId, canComment, onSaved);
  const hint = canComment ? "Highlight caption wording to add a note. Click marked wording to see its flag." : "Click marked wording to see its flag.";
  return (
    <section aria-label="Caption" className="flex flex-col gap-2 rounded-xl border border-border/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Caption</h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <p id={captionTextId(submissionId)} ref={contentRef} onPointerUp={captureSelection} onKeyUp={captureSelection} onClickCapture={onCaptionClick} className="select-text whitespace-pre-wrap break-words text-sm text-foreground/90">
        {hasCaption ? children : <span className="text-muted-foreground">No caption.</span>}
      </p>
      {canComment && hasCaption && (
        <Button type="button" variant="outline" size="sm" className="self-start gap-1.5" disabled={!quote} onPointerDown={(event) => event.preventDefault()} onClick={() => onOpenChange(true)}>
          <MessageSquarePlus className="size-4" /> Add note to selected text
        </Button>
      )}
      <CaptionNoteDialog open={open} onOpenChange={onOpenChange} quote={quote} note={note} onNote={setNote} saving={saving} onSave={save} />
    </section>
  );
}
