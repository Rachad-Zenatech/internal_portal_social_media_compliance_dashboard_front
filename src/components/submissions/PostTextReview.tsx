import { Button } from "@/components/ui/button";
import { usePostTextReview } from "@/hooks/usePostTextReview";
import PostTextHistory, { PostTextChanges } from "./PostTextChanges";
import PostTextVersions from "./PostTextVersions";

export default function PostTextReview({ submissionId, allowEdit = false }: { submissionId: string; allowEdit?: boolean }) {
  const review = usePostTextReview(submissionId);
  const { query, draft, text, changed, saving, checking, recheck, conflict, edit, cancel, save, setText } = review;
  if (query.isPending) return <p className="text-xs text-muted-foreground">Loading text changes…</p>;
  if (query.isError) return <div role="alert" className="text-sm text-red-600">Text changes could not be loaded. <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div>;
  if (!query.data) return null;
  const canEdit = allowEdit && query.data.can_edit;
  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Post text edits">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Post text and version history</h3>
        {canEdit && !draft && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={checking} onClick={edit}>Edit post text</Button><Button size="sm" variant="outline" disabled={checking} onClick={() => void recheck()}>{checking ? "Checking…" : "Run compliance check"}</Button></div>}
      </div>
      {draft && <TextReviewEditor text={text} base={draft.base.text} latest={query.data.text} conflict={conflict} disabled={saving || !canEdit} onChange={setText} />}
      {draft && <div className="flex gap-2"><Button size="sm" disabled={saving || !canEdit || !changed || !text.trim() || conflict} onClick={() => void save()}>{saving ? "Saving…" : "Save text changes"}</Button><Button size="sm" variant="outline" disabled={saving} onClick={cancel}>{conflict ? "Discard draft and load latest" : "Cancel"}</Button></div>}
      <PostTextVersions text={query.data.text} edits={query.data.edits} />
      <PostTextHistory edits={query.data.edits} />
    </section>
  );
}

function TextReviewEditor({ text, base, latest, conflict, disabled, onChange }: {
  text: string; base: string; latest: string; conflict: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs font-medium">Post text<textarea aria-label="Edit post text" className="block min-h-48 w-full rounded-lg border border-input bg-background p-3 text-sm" maxLength={100000} value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>
      {conflict && <div role="alert" className="space-y-2 rounded-lg border border-amber-500 p-3 text-sm"><p>The post changed while you were editing. Copy your unsaved work before loading the latest text.</p><p className="font-medium">Latest saved text</p><p className="whitespace-pre-wrap">{latest}</p></div>}
      <div className="space-y-1"><p className="text-xs font-medium">Your changes (not saved yet)</p><PostTextChanges before={base} after={text} /></div>
    </div>
  );
}
