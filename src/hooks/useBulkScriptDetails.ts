import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { scriptDocService } from "@/services/scriptDocService";
import type { BatchDetails } from "@/types/scriptBatch";
import type { DocDetail } from "@/types/scriptDoc";

/** Prepare all post details before starting any of the batch's compliance checks. */
export function useBulkScriptDetails(doc: DocDetail) {
  const client = useQueryClient();
  const [sameForAll, setSameForAll] = useState(doc.shared_details !== false);
  const [shared, setShared] = useState<BatchDetails>(doc.details);
  const [drafts, setDrafts] = useState<Record<string, BatchDetails>>({});
  const [missing, setMissing] = useState<Record<string, string[]>>({});
  const queries = useQueries({ queries: doc.pages.map((page) => ({
    queryKey: ["script-doc", page.id], queryFn: () => scriptDocService.get(page.id),
  })) });
  const scripts = queries.flatMap((query) => query.data ? [query.data] : []);
  const loading = queries.some((query) => query.isPending);
  const failed = queries.some((query) => query.isError);
  const editable = scripts.filter((script) => script.access.can_submit);
  const changeScript = (id: string, details: BatchDetails) => {
    setDrafts((previous) => ({ ...previous, [id]: details }));
    setMissing((previous) => ({ ...previous, [id]: [] }));
  };
  const save = async (onlyId?: string) => {
    if (loading || failed || scripts.length !== doc.pages.length) throw new Error("Couldn't load every script. Close this dialog and try again.");
    const targets = onlyId ? editable.filter((script) => script.id === onlyId) : editable;
    const anchor = targets.find((script) => script.id === doc.id) ?? targets[0];
    if (anchor) {
      if (sameForAll) {
        if (anchor.shared_details !== true || JSON.stringify(shared) !== JSON.stringify(anchor.details)) {
          await scriptDocService.update(anchor.id, { shared_details: true, details: shared });
        }
      } else {
        if (anchor.shared_details !== false) await scriptDocService.update(anchor.id, { shared_details: false });
        await Promise.all(targets.filter((script) => JSON.stringify(drafts[script.id] ?? script.details) !== JSON.stringify(script.details)).map((script) => scriptDocService.update(script.id, {
          shared_details: false, details: drafts[script.id] ?? script.details,
        })));
      }
    }
    const saved = await Promise.all(scripts.map((script) => scriptDocService.get(script.id)));
    for (const script of saved) {
      client.setQueryData(["script-doc", script.id], script);
      void client.invalidateQueries({ queryKey: ["script-doc-check", script.id] });
    }
    const incomplete = saved.filter((script) => (!onlyId || script.id === onlyId) && script.access.can_submit && script.missing_details.length);
    setMissing(Object.fromEntries(incomplete.map((script) => [script.id, script.missing_details])));
    if (incomplete.length) throw new Error(`Complete post details for: ${incomplete.map((script) => script.title).join(", ")}.`);
  };
  return { sameForAll, setSameForAll, shared, setShared, drafts, changeScript, missing,
    scripts, loading, failed, canEdit: editable.length > 0, save };
}
