import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ReviewRichTextEditor from "./ReviewRichTextEditor";
import type { ReviewTextValue } from "@/lib/reviewText";
import CaptionChangeDialog from "./CaptionChangeDialog";

export default function CaptionEditor({ base, draft, onDraft, onSave, onCancel, saving, error, html, changed, rich = true }: {
  base: string; draft: string; onDraft: (value: ReviewTextValue) => void; html: string | null; changed: boolean; rich?: boolean;
  onSave: () => void; onCancel: () => void; saving: boolean; error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {rich ? <ReviewRichTextEditor value={{ text: draft, html }} onChange={onDraft} disabled={saving} />
        : <label className="space-y-2 text-sm font-medium">Edit text<Textarea value={draft} onChange={event => onDraft({ text: event.target.value, html: null })} maxLength={100000} disabled={saving} className="min-h-48 whitespace-pre-wrap" /></label>}
      <p className="text-xs text-muted-foreground">Your changes update the post's text. Each saved edit records your name and can be compared in Edit history.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-card py-3">
        <Button type="button" size="sm" onClick={onSave} disabled={saving || !draft.trim() || !changed}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        {changed && <CaptionChangeDialog before={base} after={draft} label="Preview changes" />}
      </div>
    </div>
  );
}
