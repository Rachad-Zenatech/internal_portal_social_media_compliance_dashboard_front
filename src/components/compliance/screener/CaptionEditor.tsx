import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CaptionChangeDialog from "./CaptionChangeDialog";

export default function CaptionEditor({ base, draft, onDraft, onSave, onCancel, saving, error }: {
  base: string; draft: string; onDraft: (value: string) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label className="flex flex-col gap-2 text-sm font-medium">Edit caption
        <Textarea value={draft} onChange={(event) => onDraft(event.target.value)} maxLength={100_000} disabled={saving} className="min-h-48 whitespace-pre-wrap" />
      </label>
      <p className="text-xs text-muted-foreground">Your changes update the post's caption. Each saved edit records your name and can be compared in Edit history.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-card py-3">
        <Button type="button" size="sm" onClick={onSave} disabled={saving || !draft.trim() || base === draft}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        {base !== draft && <CaptionChangeDialog before={base} after={draft} label="Preview changes" />}
      </div>
    </div>
  );
}
