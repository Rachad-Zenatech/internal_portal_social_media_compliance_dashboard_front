import FormattedCaptionPreview from "@/components/submissions/FormattedCaptionPreview";
import { useId, useState } from "react";
import { format } from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import type { PostTextEdit } from "@/types/postTextReview";

export default function PostTextVersions({ text, html, edits }: { text: string; html?: string | null; edits: PostTextEdit[] }) {
  useUserTimezone();
  const id = useId();
  const [selected, setSelected] = useState("current");
  const edit = edits.find((item) => item.id === selected);
  const beforeFirstEdit = selected === "before" && edits.length > 0;
  const value = edit ? edit.id : beforeFirstEdit ? "before" : "current";
  const savedText = edit ? edit.after_text : beforeFirstEdit ? edits[0].before_text : text;
  const savedHtml = edit ? edit.after_html : beforeFirstEdit ? edits[0].before_html : html;
  const description = edit ? `Saved by ${edit.reviewer_name} on ${format(new Date(edit.created_at), "MMM d, yyyy, h:mm a zzz")}. Review round ${edit.version}.`
    : beforeFirstEdit ? "The saved post text before the first reviewer edit." : "The current saved post text.";
  const options = edits.map((item, index) => (
    <option key={item.id} value={item.id}>Reviewer revision {index + 1} · {item.reviewer_name} · Review round {item.version}</option>
  )).toReversed();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-medium">Saved text version</label>
      <select id={id} value={value} onChange={(event) => setSelected(event.target.value)} className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
        <option value="current">Current saved text</option>
        {options}
        {edits.length > 0 && <option value="before">Before first reviewer edit</option>}
      </select>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div aria-label="Saved post text" className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/20 p-3 text-sm leading-relaxed"><FormattedCaptionPreview html={savedHtml ?? undefined} parts={[{ text: savedText || "No post text saved yet.", tone: "" }]} /></div>
    </div>
  );
}
