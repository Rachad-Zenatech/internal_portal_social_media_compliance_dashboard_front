import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import ReviewRichTextEditor from "@/components/compliance/screener/ReviewRichTextEditor";
import type { ReviewTextValue } from "@/lib/reviewText";
import { Button } from "@/components/ui/button";
import { usePostTextReview } from "@/hooks/usePostTextReview";
import PostTextHistory, { PostTextChanges } from "./PostTextChanges";
import PostTextVersions from "./PostTextVersions";

export default function PostTextReview({ submissionId, allowEdit = false, reviewerView = false, missingCheck = false, renderText }: { submissionId: string; allowEdit?: boolean; reviewerView?: boolean; missingCheck?: boolean; renderText?: (text: string, html?: string | null) => ReactNode }) {
  const review = usePostTextReview(submissionId);
  const { query, draft, text, html, changed, saving, checking, recheck, conflict, edit, cancel, save, setValue } = review;
  if (query.isPending) return <p className="text-xs text-muted-foreground">Loading text changes…</p>;
  if (query.isError) return <div role="alert" className="text-sm text-red-600">Text changes could not be loaded. <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></div>;
  if (!query.data) return null;
  const canEdit = allowEdit && query.data.can_edit;
  const showRecheck = !reviewerView || review.needsRecheck || (missingCheck && query.data.edits.length > 0);
  return (
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Post text edits">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{reviewerView ? "Text" : "Post text and version history"}</h3>
        {canEdit && !draft && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={checking} onClick={edit}>{reviewerView ? <><Pencil className="mr-2 size-3.5" />Edit text</> : "Edit post text"}</Button>{showRecheck && <Button size="sm" variant="outline" disabled={checking} onClick={() => void recheck()}>{checking ? "Checking…" : "Run compliance check"}</Button>}</div>}
      </div>
      {draft && <TextReviewEditor html={html} text={text} latest={query.data.text} conflict={conflict} disabled={saving || !canEdit} onChange={setValue} />}
      {draft && <div className="flex gap-2"><Button size="sm" disabled={saving || !canEdit || !changed || !text.trim() || conflict} onClick={() => void save()}>{saving ? "Saving…" : "Save text changes"}</Button><Button size="sm" variant="outline" disabled={saving} onClick={cancel}>{conflict ? "Discard draft and load latest" : "Cancel"}</Button></div>}
      {draft && <div aria-label="Unsaved text changes" className="space-y-1"><p className="text-xs font-medium">Your changes (not saved yet)</p><PostTextChanges before={draft.base.text} after={text} /></div>}
      {reviewerView ? !draft && <div aria-label="Saved post text" className="w-full min-w-0 text-foreground/90">{renderText?.(query.data.text, query.data.html) ?? query.data.text}</div>
        : <PostTextVersions html={query.data.html} text={query.data.text} edits={query.data.edits} />}
      <PostTextHistory edits={query.data.edits} />
    </section>
  );
}

function TextReviewEditor({ html, text, latest, conflict, disabled, onChange }: {
  html: string | null; text: string; latest: string; conflict: boolean; disabled: boolean; onChange: (value: ReviewTextValue) => void;
}) {
  return (
    <div className="space-y-3">
      <ReviewRichTextEditor label="Edit post text" value={{ text, html }} onChange={onChange} disabled={disabled} />
      {conflict && <div role="alert" className="space-y-2 rounded-lg border border-amber-500 p-3 text-sm"><p>The post changed while you were editing. Copy your unsaved work before loading the latest text.</p><p className="font-medium">Latest saved text</p><p className="whitespace-pre-wrap">{latest}</p></div>}
    </div>
  );
}
