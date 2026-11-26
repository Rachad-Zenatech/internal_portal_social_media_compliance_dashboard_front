import BatchDetailsForm from "@/components/script/BatchDetailsForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBulkScriptDetails } from "@/hooks/useBulkScriptDetails";
import type { BatchDetails } from "@/types/scriptBatch";
import type { DocDetail } from "@/types/scriptDoc";

function ScriptDetails({ script, details, missing, busy, onChange }: {
  script: DocDetail; details: BatchDetails; missing: string[]; busy: boolean; onChange: (value: BatchDetails) => void;
}) {
  const disabled = busy || !script.access.can_submit;
  return (
    <details open className="rounded-lg border p-3">
      <summary className="mb-3 cursor-pointer text-sm font-semibold">{script.title}{missing.length > 0 && ` - ${missing.length} details missing`}</summary>
      {!script.access.can_submit && <p className="mb-3 text-xs text-muted-foreground">Already sent for review. These saved details will be used.</p>}
      <BatchDetailsForm details={details} missing={missing} disabled={disabled} hideReviewers idPrefix={`bulk-${script.id}`} onChange={onChange} />
    </details>
  );
}

export default function BulkScriptDetailsDialog({ doc, busy, onClose, onRun }: {
  doc: DocDetail; busy: boolean; onClose: () => void; onRun: (prepare: () => Promise<void>) => Promise<boolean>;
}) {
  const state = useBulkScriptDetails(doc);
  const run = async () => { if (await onRun(state.save)) onClose(); };
  const sharedMissing = [...new Set(Object.values(state.missing).flat())];
  const unavailable = state.loading || state.failed;
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden sm:max-w-6xl" onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Post details and bulk compliance</DialogTitle>
          <DialogDescription>Fill in post details, then check all {doc.pages.length} scripts. Each script is checked against its own sources.</DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium">
          <Checkbox checked={state.sameForAll} disabled={busy || unavailable || !state.canEdit} onCheckedChange={(checked) => state.setSameForAll(checked === true)} />
          Post details are the same for all scripts
        </label>
        {state.scripts.some((script) => !script.access.can_submit) && <p className="text-xs text-muted-foreground">Scripts already sent for review keep their saved post details.</p>}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {state.loading && <p className="text-sm text-muted-foreground">Loading script details...</p>}
          {state.failed && <p role="alert" className="text-sm text-destructive">Couldn't load every script. Close this dialog and try again.</p>}
          {!unavailable && state.sameForAll && <BatchDetailsForm details={state.shared} missing={sharedMissing} disabled={busy || !state.canEdit} hideReviewers idPrefix="bulk-shared" onChange={state.setShared} />}
          {!unavailable && !state.sameForAll && state.scripts.map((script) => <ScriptDetails key={script.id} script={script} details={state.drafts[script.id] ?? script.details} missing={state.missing[script.id] ?? []} busy={busy} onChange={(value) => state.changeScript(script.id, value)} />)}
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || unavailable} onClick={() => void run()}>{busy ? "Preparing compliance..." : "Save details and check all scripts"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
