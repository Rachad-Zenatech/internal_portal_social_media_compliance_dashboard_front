import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useScriptCheckStatus } from "@/hooks/useScriptCheckStatus";
import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import { pendingScriptChecks } from "@/services/backgroundScriptChecks";
import { runDocumentScriptCompliance } from "@/services/documentScriptChecks";
import type { DocDetail } from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";

export function useDocumentScriptChecks(doc: DocDetail, beforeCheck: () => Promise<void>) {
  const queryClient = useQueryClient();
  const { addJob } = useGlobalProgress();
  const [preparing, setPreparing] = useState(false);
  const key = doc.set_id ?? doc.id;
  const pending = useScriptCheckStatus("document", key);
  const results = useQueries({ queries: doc.pages.map((page) => ({
    queryKey: ["script-doc-check", page.id], queryFn: async (): Promise<StoredCheck | null> => null, enabled: false,
  })) });
  const run = async () => {
    if (preparing || pendingScriptChecks(`document:${key}`).length) return;
    setPreparing(true);
    try {
      await beforeCheck();
      const running = runDocumentScriptCompliance(key, doc.pages.map((page) => page.id), (id, check) => {
        queryClient.setQueryData(["script-doc-check", id], check);
      });
      addJob("Checking script compliance", running, {
        key: `document-compliance:${key}`, type: "check", link_url: `/script-docs/${doc.id}`,
        description: `Checking ${doc.pages.length} scripts. You can leave this page.`,
        doneMessage: "Script compliance checks finished",
      });
      void running.catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't finish all script checks"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the current script");
    } finally { setPreparing(false); }
  };
  return { run, busy: preparing || pending.length > 0, pending, results };
}
