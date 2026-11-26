import type { RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import { scriptDocService } from "@/services/scriptDocService";
import { scriptSourcesMatch } from "@/lib/scriptSources";
import type { DocDetail } from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";

export function useScriptDocCompliance(doc: DocDetail, editor: RefObject<CollabEditorHandle | null>, sources: { dirty: boolean; saving: boolean }) {
  const queryClient = useQueryClient();
  const { data: cached = null } = useQuery<StoredCheck | null>({
    queryKey: ["script-doc-check", doc.id], queryFn: async () => null, enabled: false,
  });
  const check = doc.latest_check ?? cached;
  const stale = Boolean(check && (doc.compliance_stale || sources.dirty || !scriptSourcesMatch(check.checked_script_sources, doc.sources_text ?? "")));
  const runCheck = useMutation({
    mutationFn: async () => {
      if (sources.dirty || sources.saving) throw new Error("Save sources before running compliance.");
      const current = editor.current;
      if (current && !doc.share_document_id && doc.access.can_edit) {
        await scriptDocService.snapshot(doc.id, current.getHtml(), current.getText());
      }
      return scriptDocService.check(doc.id, current?.getText());
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(["script-doc-check", doc.id], result);
      // Read the saved result and compare it with edits that may have arrived
      // while the check was running, rather than assuming it is still current.
      await queryClient.invalidateQueries({ queryKey: ["script-doc", doc.id] });
    },
    onError: (error: Error) => toast.error(error.message || "The check couldn't run"),
  });
  return { check, stale, runCheck };
}
