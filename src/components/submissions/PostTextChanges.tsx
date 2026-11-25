import { useMemo } from "react";
import { diffWords, type DiffPart } from "@/lib/wordDiff";
import type { PostTextEdit } from "@/types/postTextReview";

export function PostTextChanges({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{parts.map((part, index) => <TextChangePart key={index} part={part} />)}</div>;
}

function TextChangePart({ part }: { part: DiffPart }) {
  if (part.kind === "same") return <span>{part.after}</span>;
  return <><del className="bg-red-500/15 text-red-800 dark:text-red-300 decoration-2">{part.removed}</del><ins className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 underline decoration-2">{part.added}</ins></>;
}

export default function PostTextHistory({ edits }: { edits: PostTextEdit[] }) {
  if (!edits.length) return <p className="text-xs text-muted-foreground">No reviewer text changes yet.</p>;
  return (
    <section aria-label="Reviewer text change history" className="space-y-3">
      <p className="text-xs text-muted-foreground">Additions are green and underlined. Removals are red and crossed out.</p>
      {edits.toReversed().map((edit, index) => <PostTextHistoryEntry key={edit.id} edit={edit} latest={index === 0} />)}
    </section>
  );
}

function PostTextHistoryEntry({ edit, latest }: { edit: PostTextEdit; latest: boolean }) {
  const time = new Date(edit.created_at).toLocaleString();
  return (
    <details open={latest} className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer text-xs font-medium">{edit.reviewer_name} · {time} · Version {edit.version}</summary>
      <div className="mt-3"><PostTextChanges before={edit.before_text} after={edit.after_text} /></div>
    </details>
  );
}
