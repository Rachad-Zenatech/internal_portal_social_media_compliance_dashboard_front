import BatchDetailsForm from "@/components/script/BatchDetailsForm";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkScriptDetails } from "@/hooks/useBulkScriptDetails";
import type { DocDetail } from "@/types/scriptDoc";
import ScriptDetailsSection from "@/components/scriptdoc/ScriptDetailsSection";
import ScriptSectionCompliance from "@/components/scriptdoc/ScriptSectionCompliance";

export default function BulkScriptDetailsPanel({ doc, onPrepare, onWorkspaceHost, onBeforeCheck }: {
  doc: DocDetail; onPrepare?: (prepare: (() => Promise<void>) | null) => void;
  onWorkspaceHost?: (host: HTMLDivElement | null) => void;
  onBeforeCheck?: () => Promise<void>;
}) {
  const state = useBulkScriptDetails(doc);
  const { mutate, mutateAsync, isPending: busy, error } = useMutation({ mutationFn: state.save });
  useEffect(() => {
    onPrepare?.(() => mutateAsync(undefined));
    return () => onPrepare?.(null);
  }, [mutateAsync, onPrepare]);
  const sharedMissing = [...new Set(Object.values(state.missing).flat())];
  const unavailable = state.loading || state.failed;
  const beforeAllChecks = async () => { await onBeforeCheck?.(); await mutateAsync(undefined); };
  const allDirty = state.scripts.some((script) => script.compliance_stale || JSON.stringify(state.drafts[script.id] ?? script.details) !== JSON.stringify(script.details));
  const sections = state.scripts.map((script) => (
    <ScriptDetailsSection key={script.id} script={script} active={script.id === doc.id}
      details={state.drafts[script.id] ?? script.details} missing={state.missing[script.id] ?? []} busy={busy}
      onChange={(value) => state.changeScript(script.id, value)} onWorkspaceHost={onWorkspaceHost}
      beforeCheck={async () => { await onBeforeCheck?.(); await mutateAsync(script.id); }} />
  ));
  return (
    <div className="space-y-3" aria-label="Post details for all scripts">
        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium">
          <Checkbox checked={state.sameForAll} disabled={busy || unavailable || !state.canEdit} onCheckedChange={(checked) => state.setSameForAll(checked === true)} />
          Post details are the same for all scripts
        </label>
        {state.scripts.some((script) => !script.access.can_submit) && <p className="text-xs text-muted-foreground">Scripts already sent for review keep their saved post details.</p>}
        <p className="text-xs text-muted-foreground">{state.sameForAll ? "Enter post details once for all scripts." : "Enter post details for each script below."}</p>
        <div className="space-y-3">
          {state.loading && <p className="text-sm text-muted-foreground">Loading script details...</p>}
          {state.failed && <p role="alert" className="text-sm text-destructive">Couldn't load every script. Close this dialog and try again.</p>}
          {!unavailable && state.sameForAll && <BatchDetailsForm details={state.shared} missing={sharedMissing} disabled={busy || !state.canEdit} hideReviewers idPrefix="bulk-shared" onChange={state.setShared} />}
          {!unavailable && !state.sameForAll && sections}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
        <p className="text-xs text-muted-foreground">Details are saved when you save below or run compliance for all scripts.</p>
        <Button size="sm" disabled={busy || unavailable || !state.canEdit} onClick={() => mutate(undefined)}>{busy ? "Saving post details..." : "Save post details"}</Button>
        {!state.sameForAll && <ScriptSectionCompliance doc={doc} all dirty={allDirty} disabled={busy || unavailable} beforeCheck={beforeAllChecks} />}
    </div>
  );
}
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
