import { Link } from "react-router-dom";
import BatchDetailsForm from "@/components/script/BatchDetailsForm";
import ScriptDocumentPreview from "@/components/script/ScriptDocumentPreview";
import SharedEditorFrame from "@/components/scriptdoc/SharedEditorFrame";
import type { BatchDetails } from "@/types/scriptBatch";
import type { DocDetail } from "@/types/scriptDoc";

/** Keep a script's own post details immediately above its editor. */
export default function ScriptDetailsSection({ script, active, details, missing, busy, onChange, onWorkspaceHost }: {
  script: DocDetail; active: boolean; details: BatchDetails; missing: string[]; busy: boolean;
  onChange: (value: BatchDetails) => void; onWorkspaceHost?: (host: HTMLDivElement | null) => void;
}) {
  const disabled = busy || !script.access.can_submit;
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={`Post details and script: ${script.title}`} data-script-section={script.id}>
      <h2 className="text-base font-semibold">Post details for {script.title}</h2>
      {missing.length > 0 && <p role="status" className="text-sm text-destructive">{missing.length} details missing</p>}
      {!script.access.can_submit && <p className="text-xs text-muted-foreground">Already sent for review. These saved details will be used.</p>}
      <BatchDetailsForm details={details} missing={missing} disabled={disabled} hideReviewers idPrefix={`bulk-${script.id}`} onChange={onChange} />
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <h3 className="text-base font-semibold">{script.title}</h3>
        {!active && <Link to={`/script-docs/${script.id}`} className="text-sm text-primary underline">Open review</Link>}
      </div>
      {active ? <div ref={onWorkspaceHost} className="min-w-0" data-active-script-workspace /> : script.share_document_id ? (
        <div className="flex min-h-[30rem] min-w-0 flex-col"><SharedEditorFrame docId={script.id} readOnly={!script.access.can_edit} lazy /></div>
      ) : <ScriptDocumentPreview text={script.body_text} terms={[]} />}
    </section>
  );
}
