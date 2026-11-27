import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocDetail } from "@/types/scriptDoc";

export function useScriptDocSources(doc: DocDetail) {
  const queryClient = useQueryClient();
  const [local, setLocal] = useState({ id: doc.id, baseline: doc.sources_text ?? "", draft: doc.sources_text ?? "" });
  const server = doc.sources_text ?? "";
  useEffect(() => {
    setLocal((previous) => previous.id !== doc.id || previous.draft === previous.baseline
      ? { id: doc.id, baseline: server, draft: server } : previous);
  }, [doc.id, server]);
  const current = local.id === doc.id ? local : { id: doc.id, baseline: server, draft: server };
  const save = useMutation({
    mutationFn: () => scriptDocService.saveSources(doc.id, current.draft, current.baseline),
    onSuccess: (updated) => {
      queryClient.setQueryData(["script-doc", doc.id], updated);
      queryClient.setQueryData(["script-doc-check", doc.id], updated.latest_check ?? null);
      queryClient.invalidateQueries({ queryKey: ["script-doc-history", doc.id] });
      setLocal({ id: doc.id, baseline: updated.sources_text, draft: updated.sources_text });
      toast.success("Sources saved. Run compliance again to check the updated evidence.");
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save sources"),
  });
  return {
    draft: current.draft,
    dirty: current.draft !== current.baseline,
    setDraft: (draft: string) => setLocal({ ...current, draft }),
    reset: () => setLocal({ id: doc.id, baseline: server, draft: server }),
    save: () => save.mutate(),
    saving: save.isPending,
  };
}
