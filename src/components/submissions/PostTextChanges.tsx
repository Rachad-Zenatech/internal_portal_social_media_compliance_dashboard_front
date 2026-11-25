import { useMemo } from "react";
import { diffWords, type DiffPart } from "@/lib/wordDiff";
import type { PostTextEdit } from "@/types/postTextReview";
import CaptionChangeDialog from "@/components/compliance/screener/CaptionChangeDialog";

export function PostTextChanges({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{parts.map((part, index) => <TextChangePart key={index} part={part} />)}</div>;
}

function TextChangePart({ part }: { part: DiffPart }) {
  if (part.kind === "same") return <span>{part.after}</span>;
  return <><del className="bg-red-500/15 text-red-800 dark:text-red-300 decoration-2">{part.removed}</del><ins className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 underline decoration-2">{part.added}</ins></>;
}

export default function PostTextHistory({ edits }: { edits: PostTextEdit[] }) {
  const entries = edits.map((edit, index) => <PostTextHistoryEntry key={edit.id} edit={edit} revision={index + 1} />).toReversed();
  if (!edits.length) return <p className="text-xs text-muted-foreground">No reviewer text changes yet.</p>;
  return (
    <section aria-label="Reviewer text change history" className="space-y-3">
      <p className="text-xs text-muted-foreground">Additions are green and underlined. Removals are red and crossed out.</p>
      {entries}
    </section>
  );
}

function PostTextHistoryEntry({ edit, revision }: { edit: PostTextEdit; revision: number }) {
  const time = new Date(edit.created_at).toLocaleString();
  const description = `Reviewer revision ${revision}, saved by ${edit.reviewer_name} on ${time}. Review round ${edit.version}.`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div><p className="text-sm font-medium">Reviewer revision {revision} · {edit.reviewer_name}</p><p className="text-xs text-muted-foreground">{time} · Review round {edit.version}</p></div>
      <CaptionChangeDialog before={edit.before_text} after={edit.after_text} subject="post text" description={description} />
    </div>
  );
}
