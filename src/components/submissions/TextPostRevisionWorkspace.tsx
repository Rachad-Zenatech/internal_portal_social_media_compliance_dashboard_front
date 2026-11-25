import { Button } from "@/components/ui/button";
import ReviewCaptionPreview from "./ReviewCaptionPreview";
import ReviewCommentsPanel from "./ReviewCommentsPanel";
import { dueInfo } from "./submissionUi";

export default function TextPostRevisionWorkspace({ submissionId, caption, dueAt, submitting, onEditCaption, onDone }: {
  submissionId: string; caption: string; dueAt?: string | null; submitting: boolean; onEditCaption: () => void; onDone: () => void;
}) {
  const due = dueInfo(dueAt, "REVISION");
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">The reviewer's comments</h2><Button size="sm" disabled={submitting} onClick={onDone}>Done: run the checks again</Button></div>
      {due && <p className="text-xs font-semibold">{due.overdue ? `Overdue: resubmit by ${due.exact}` : `Resubmit by ${due.exact}`}</p>}
      <div className="grid gap-4 lg:grid-cols-2"><ReviewCaptionPreview submissionId={submissionId} caption={caption} onEdit={onEditCaption} /><ReviewCommentsPanel submissionId={submissionId} canComment placeholder="Reply to the reviewer…" /></div>
    </section>
  );
}
