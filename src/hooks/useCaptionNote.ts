import { useRef, useState } from "react";
import { toast } from "sonner";
import { useReviewComments } from "@/hooks/useReview";
import { captionNoteBody, selectedCaptionText } from "@/lib/captionNote";

/** A reviewer note on selected caption wording, saved through the shared comment API. */
export function useCaptionNote(submissionId: string, canComment: boolean, onSaved: (id: string) => void) {
  const contentRef = useRef<HTMLParagraphElement>(null);
  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const { add } = useReviewComments(submissionId);
  const captureSelection = () => {
    if (canComment && !open) setQuote(selectedCaptionText(contentRef.current, window.getSelection()));
  };
  const onCaptionClick = (event: { stopPropagation: () => void }) => {
    if (selectedCaptionText(contentRef.current, window.getSelection())) event.stopPropagation();
  };
  const onOpenChange = (next: boolean) => {
    if (add.isPending) return;
    if (next && (!canComment || !quote)) return;
    setOpen(next);
    if (!next) {
      setNote("");
      setQuote("");
      window.getSelection()?.removeAllRanges();
    }
  };
  const save = async () => {
    if (!canComment || !quote || !note.trim() || add.isPending) return;
    try {
      const saved = await add.mutateAsync({ body: captionNoteBody(quote, note), category: "NOTE" });
      setOpen(false);
      setNote("");
      setQuote("");
      window.getSelection()?.removeAllRanges();
      onSaved(saved.id);
      toast.success("Caption note added.");
    } catch {
      // The shared comment mutation reports the error; retain the draft for retrying.
    }
  };
  return { contentRef, quote, note, setNote, open, onOpenChange, captureSelection, onCaptionClick, save, saving: add.isPending };
}
