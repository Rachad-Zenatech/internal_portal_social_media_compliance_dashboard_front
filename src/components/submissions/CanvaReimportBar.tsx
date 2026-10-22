import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CANVA_PURPLE, CanvaMark } from "@/components/submissions/CanvaImportDialog";
import { canvaService } from "@/services/canvaService";
import type { SubmissionFile } from "@/types/submission";

/**
 * For content imported from Canva: which design and revision it is, and a one-click way to bring in the latest
 * version after editing it in Canva. While changes are requested it also offers to resubmit straight away.
 */
export default function CanvaReimportBar({
  file,
  resubmitting,
  busy,
  onReimport,
}: {
  file: SubmissionFile;
  /** Changes were requested: offer "Reimport & resubmit". */
  resubmitting: boolean;
  busy: boolean;
  onReimport: (andResubmit: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const connection = useQuery({ queryKey: ["canva-connection"], queryFn: canvaService.connection });
  const isMock = connection.data?.mode === "MOCK";
  const simulateEdit = useMutation({
    mutationFn: () => canvaService.simulateEdit(file.canva_design_id!),
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["canva-designs"] });
      toast.success(`Demo: "${d.title}" is now at revision ${d.revision} in Canva. Reimport to bring it in.`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#7d2ae8]/25 bg-[#7d2ae8]/5 px-4 py-3">
      <CanvaMark className="w-6 h-6 text-[11px]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">
          From Canva: {file.canva_design_title ?? file.original_name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Revision {file.canva_revision} imported. Edited it in Canva? Bring in the latest version
          {resubmitting ? " and send it straight back to the reviewer." : "."}
          {isMock && connection.data?.connected && (
            <button
              type="button"
              className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-[#7d2ae8] hover:underline disabled:opacity-50"
              onClick={() => simulateEdit.mutate()}
              disabled={simulateEdit.isPending || busy}
            >
              <PencilLine className="w-3 h-3" /> Simulate an edit (demo)
            </button>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={resubmitting ? "outline" : "default"}
          className={`gap-1.5 text-xs ${resubmitting ? "" : CANVA_PURPLE}`}
          onClick={() => onReimport(false)}
          disabled={busy}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Reimport latest
        </Button>
        {resubmitting && (
          <Button type="button" size="sm" className={`gap-1.5 text-xs ${CANVA_PURPLE}`} onClick={() => onReimport(true)} disabled={busy}>
            <Send className="w-3.5 h-3.5" /> Reimport &amp; resubmit
          </Button>
        )}
      </div>
    </div>
  );
}
