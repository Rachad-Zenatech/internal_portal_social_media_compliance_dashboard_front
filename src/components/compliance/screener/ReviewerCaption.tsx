import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCaptionEdit } from "@/hooks/useCaptionEdit";
import CaptionEditor from "./CaptionEditor";
import CaptionEditHistory from "./CaptionEditHistory";
import { Check, Pencil } from "lucide-react";
import { captionTextId } from "@/lib/captionNote";

export default function ReviewerCaption({ submissionId, canComment, captionText, children }: {
  submissionId: string;
  canComment: boolean;
  captionText: string;
  children: (text: string, html: string | null | undefined, showFlags: boolean) => ReactNode;
}) {
  const state = useCaptionEdit(submissionId);
  const { query, editor, platform } = state;
  const editable = canComment && query.data?.can_edit;
  const platformOptions = query.data?.platforms.map((name) => <option key={name} value={name}>{name.toLowerCase().replaceAll("_", " ")}</option>);
  const hasOverrides = Boolean(Object.keys(query.data?.platform_captions ?? {}).length);
  const showSelector = (query.data?.platforms.length ?? 0) > 1 || hasOverrides;
  const current = query.data ? state.current : captionText;
  const mainCaption = !platform || !query.data?.platform_captions[platform];
  const html = mainCaption ? query.data?.caption_html : undefined;
  const showFlags = mainCaption && current === captionText && !query.data?.needs_recheck;
  const caption = children(current, html, showFlags);
  return (
    <section aria-label="Text" className="flex min-w-0 flex-col gap-4 rounded-xl border border-border/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Text</h3>
        {editable && !editor && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={state.start}><Pencil className="size-3.5" />Edit text</Button>}
      </div>
      {showSelector ? <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Show text for
        <select aria-label="Text for" className="max-w-full rounded-md border bg-background px-2 py-1.5 capitalize text-foreground" value={platform} onChange={(event) => state.setPlatform(event.target.value)} disabled={Boolean(editor)}>
          <option value="">Default text</option>{platformOptions}
        </select>
      </label> : <p className="text-xs text-muted-foreground">The text that will appear with this post.</p>}
      {editor ? <CaptionEditor rich={!platform} html={editor.html} changed={state.changed} base={editor.base} draft={editor.draft} onDraft={state.setDraft} onSave={state.save} onCancel={state.cancel} saving={state.saving} error={state.error} />
        : <div id={captionTextId(submissionId)} className="w-full min-w-0 text-foreground/90">{current ? caption : <span className="text-sm text-muted-foreground">No text yet. Add it using Edit text.</span>}</div>}
      {query.isError && <p role="alert" className="text-sm text-destructive">Text history could not load. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p>}
      {state.saved && !editor && <div role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><Check className="mt-0.5 size-3.5 shrink-0" /><p><span className="font-medium">Text saved.</span> Ready for review. Compliance will run again before approval.</p></div>}
      <CaptionEditHistory revisions={query.data?.revisions ?? []} />
    </section>
  );
}
