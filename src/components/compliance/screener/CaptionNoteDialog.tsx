import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CaptionNoteDialog({ open, onOpenChange, quote, note, onNote, saving, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: string;
  note: string;
  onNote: (note: string) => void;
  saving: boolean;
  onSave: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a text note</DialogTitle>
          <DialogDescription>Your note will include this text excerpt and appear in the post's review comments.</DialogDescription>
        </DialogHeader>
        <blockquote className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border-l-4 border-blue-500 bg-muted p-3 text-sm">{quote}</blockquote>
        <label htmlFor="caption-review-note" className="text-sm font-medium">Reviewer note</label>
        <Textarea id="caption-review-note" value={note} onChange={(event) => onNote(event.target.value)} placeholder="What should change in this wording?" disabled={saving} autoFocus />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving || !note.trim()}>{saving ? "Saving…" : "Save text note"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
