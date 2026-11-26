import type { CaptionRevision } from "@/types/captionEdit";
import type { PostTextEdit } from "@/types/postTextReview";

export interface IncomingTextChange { key: string; label: string; before: string; after: string; authors: string[] }

/** Compare each platform's submitted text with the final incoming revision, retaining attribution. */
export function incomingCaptionChanges(revisions: CaptionRevision[], version: number): IncomingTextChange[] {
  const groups = new Map<string, CaptionRevision[]>();
  for (const edit of revisions.filter(item => item.version === version).toSorted((a, b) => a.id - b.id)) {
    const key = edit.platform || "main";
    groups.set(key, [...(groups.get(key) ?? []), edit]);
  }
  return [...groups].map(([key, edits]) => ({ key, label: key === "main" ? "Main caption" : key.replaceAll("_", " "),
    before: edits[0].before, after: edits.at(-1)!.after, authors: [...new Set(edits.map(edit => edit.actor_name))] }));
}

export function incomingPostTextChanges(edits: PostTextEdit[], version: number): IncomingTextChange[] {
  const round = edits.filter(edit => edit.version === version).toSorted((a, b) => a.created_at.localeCompare(b.created_at));
  return round.length ? [{ key: "text", label: "Post text", before: round[0].before_text, after: round.at(-1)!.after_text,
    authors: [...new Set(round.map(edit => edit.reviewer_name))] }] : [];
}
