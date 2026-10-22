import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, Film, Image as ImageIcon, Link2, Loader2, LogOut, PencilLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { canvaService } from "@/services/canvaService";
import type { CanvaDesign } from "@/types/canva";
import type { ContentType, Submission } from "@/types/submission";

/** Which content types a design can be the main file of (mirrors the server's allowed file types). */
const FITS: Record<CanvaDesign["kind"], ContentType[]> = {
  VIDEO: ["VIDEO", "SOCIAL_POST", "AD"],
  IMAGE: ["IMAGE", "CAROUSEL", "SOCIAL_POST", "AD"],
};

export const designFits = (kind: CanvaDesign["kind"], contentType: ContentType) => FITS[kind].includes(contentType);

/** Canva's purple, for the Canva buttons and marks. */
export const CANVA_PURPLE = "bg-[#7d2ae8] hover:bg-[#6a1fd0] text-white";

export function CanvaMark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <span className={`${className} inline-grid place-items-center rounded-full bg-gradient-to-br from-[#00c4cc] to-[#7d2ae8] text-[9px] font-black text-white`}>
      C
    </span>
  );
}

/**
 * Pick a Canva design and import it as the submission's main file. Connects the Canva account first if needed.
 * The mock Canva (until the API keys exist) offers a few sample designs and a way to simulate edits.
 */
export default function CanvaImportDialog({
  open,
  onOpenChange,
  contentType,
  ensureSubmissionId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: ContentType;
  /** Creates the draft if it doesn't exist yet. */
  ensureSubmissionId: () => Promise<string | null>;
  onImported: (submission: Submission) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const connection = useQuery({ queryKey: ["canva-connection"], queryFn: canvaService.connection, enabled: open });
  const connected = Boolean(connection.data?.connected);
  const isMock = connection.data?.mode === "MOCK";
  const designs = useQuery({ queryKey: ["canva-designs"], queryFn: canvaService.designs, enabled: open && connected });

  const connect = useMutation({
    mutationFn: canvaService.connect,
    onSuccess: (c) => {
      queryClient.setQueryData(["canva-connection"], c);
      toast.success(`Canva connected${c.display_name ? ` as ${c.display_name}` : ""}.`);
    },
    onError: (err) => toast.error(`Couldn't connect Canva: ${(err as Error).message}`),
  });
  const disconnect = useMutation({
    mutationFn: canvaService.disconnect,
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["canva-connection"] });
      queryClient.removeQueries({ queryKey: ["canva-designs"] });
    },
  });
  const simulateEdit = useMutation({
    mutationFn: canvaService.simulateEdit,
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["canva-designs"] });
      toast.success(`"${d.title}" is now at revision ${d.revision} in Canva.`);
    },
    onError: (err) => toast.error((err as Error).message),
  });
  const importDesign = useMutation({
    mutationFn: async (designId: string) => {
      const id = await ensureSubmissionId();
      if (!id) throw new Error("Couldn't create the draft");
      return canvaService.importDesign(id, designId);
    },
    onSuccess: (submission) => {
      const design = designs.data?.find((d) => d.id === selected);
      onImported(submission);
      toast.success(`Imported "${design?.title ?? "the design"}" from Canva.`);
      setSelected(null);
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Couldn't import the design: ${(err as Error).message}`),
  });

  const choice = designs.data?.find((d) => d.id === selected);

  return (
    <Dialog open={open} onOpenChange={(o) => !importDesign.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CanvaMark className="w-5 h-5" /> Import from Canva
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pick a design. It's exported from Canva into ZenaTech's secure file storage and added as your content, then goes
            through review like any upload.
          </DialogDescription>
        </DialogHeader>

        {isMock && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
            <strong>Demo Canva.</strong> These are sample designs until the Canva API keys are set up. "Simulate an edit" stands in
            for changing a design in Canva, so you can try reimporting a new revision.
          </p>
        )}

        {connection.isLoading ? (
          <p className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking your Canva connection...
          </p>
        ) : !connected ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CanvaMark className="w-12 h-12 text-lg" />
            <div>
              <p className="text-sm font-semibold text-foreground">Connect your Canva account</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5" /> Secure Canva authorization. We only read the designs you choose to import.
              </p>
            </div>
            <Button className={`gap-1.5 ${CANVA_PURPLE}`} onClick={() => connect.mutate()} disabled={connect.isPending}>
              {connect.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Connect Canva
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Connected as <strong className="text-foreground">{connection.data?.display_name}</strong>
              </span>
              <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => disconnect.mutate()}>
                <LogOut className="w-3.5 h-3.5" /> Disconnect
              </button>
            </div>
            {designs.isLoading ? (
              <p className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your designs...
              </p>
            ) : designs.isError ? (
              <p className="py-10 text-center text-sm text-red-600">Couldn't load your designs: {(designs.error as Error).message}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                {designs.data?.map((d) => {
                  const fits = designFits(d.kind, contentType);
                  const active = selected === d.id;
                  return (
                    <div
                      key={d.id}
                      role="button"
                      tabIndex={fits ? 0 : -1}
                      aria-pressed={active}
                      aria-disabled={!fits}
                      onClick={() => fits && setSelected(d.id)}
                      onKeyDown={(e) => fits && (e.key === "Enter" || e.key === " ") && setSelected(d.id)}
                      title={fits ? undefined : `A ${d.kind.toLowerCase()} design can't be the main file of this submission type`}
                      className={`group rounded-xl border p-2 text-left transition-all ${
                        !fits
                          ? "opacity-45 cursor-not-allowed border-border/60"
                          : active
                          ? "cursor-pointer border-[#7d2ae8] ring-2 ring-[#7d2ae8]/30"
                          : "cursor-pointer border-border/70 hover:border-[#7d2ae8]/50"
                      }`}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                        <img src={authedFileUrl(d.thumbnail_url)} alt="" className="h-full w-full object-contain" loading="lazy" />
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {d.kind === "VIDEO" ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                          {d.kind === "VIDEO" ? "Video" : "Image"}
                        </span>
                        {active && (
                          <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#7d2ae8] text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-foreground">{d.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Revision {d.revision} · edited {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                      </p>
                      {isMock && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            simulateEdit.mutate(d.id);
                          }}
                          disabled={simulateEdit.isPending}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7d2ae8] hover:underline disabled:opacity-50"
                        >
                          <PencilLine className="w-3 h-3" /> Simulate an edit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="items-center">
          {importDesign.isPending && (
            <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting from Canva and saving to secure storage...
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={importDesign.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            className={`gap-1.5 ${CANVA_PURPLE}`}
            disabled={!choice || importDesign.isPending}
            onClick={() => choice && importDesign.mutate(choice.id)}
          >
            Import design
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
