import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ScriptStageCard from "@/components/script/ScriptStageCard";
import { useScriptStage } from "@/hooks/useScript";
import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import { submissionService } from "@/services/submissionService";

const ACCEPT_SCRIPT = ".pdf,.docx,.doc,.txt,.md";

export default function UploadScriptDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSubmissionId?: string | null;
  onSuccess?: (submissionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { addJob } = useGlobalProgress();
  const scriptInputRef = useRef<HTMLInputElement | null>(null);

  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [createdPostRef, setCreatedPostRef] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [uploadingScript, setUploadingScript] = useState(false);

  // Reset state whenever the dialog opens so each upload creates a new script post
  useEffect(() => {
    if (open) {
      setCreatedPostId(null);
      setCreatedPostRef(null);
      setTitle("");
      setUploadingScript(false);
    }
  }, [open]);

  const scriptStage = useScriptStage(createdPostId, open && Boolean(createdPostId));

  // Close dialog automatically when script status transitions to IN_REVIEW after clicking "Send script for review"
  const prevStatusRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const current = scriptStage.data?.status;
    if (
      prevStatusRef.current &&
      prevStatusRef.current !== "IN_REVIEW" &&
      current === "IN_REVIEW" &&
      createdPostId
    ) {
      if (onSuccess) onSuccess(createdPostId);
      onOpenChange(false);
    }
    prevStatusRef.current = current;
  }, [scriptStage.data?.status, createdPostId, onSuccess, onOpenChange]);

  const handleScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setUploadingScript(true);
    try {
      let subId = createdPostId;
      if (!subId) {
        const postTitle =
          title.trim() ||
          selected.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ") ||
          "New Video Script";
        const created = await submissionService.create(postTitle, "VIDEO");
        subId = created.id;
        setCreatedPostId(subId);
        setCreatedPostRef(created.reference_code);
        if (!title.trim()) setTitle(postTitle);
      } else if (title.trim()) {
        await submissionService.update(subId, { title: title.trim() });
      }

      const uploadPromise = submissionService.uploadFile(subId, "SCRIPT", selected);
      addJob(selected.name, uploadPromise, {
        description: "Uploading & reading script...",
        type: "document",
        submissionId: subId,
        link_url: `/compliance/scanner?script=${subId}`,
      });
      await uploadPromise;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["script", subId] }),
        queryClient.invalidateQueries({ queryKey: ["submission", subId] }),
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
      ]);
      toast.success(`Uploaded ${selected.name} to new post.`);
    } catch (err) {
      toast.error(`Couldn't upload script: ${(err as Error).message}`);
    } finally {
      setUploadingScript(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !uploadingScript) {
      prevStatusRef.current = undefined;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Upload New Script</DialogTitle>
          <DialogDescription>
            Create a new video post draft with its script (PDF, Word or .txt), preview it, and send it for review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 min-w-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="script-title" className="text-xs font-medium text-foreground">
              Video Post Title
            </Label>
            <Input
              id="script-title"
              placeholder="e.g. Shaun Instagram Reels - AV Scripts"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (createdPostId && title.trim()) {
                  submissionService.update(createdPostId, { title: title.trim() }).catch(() => {});
                }
              }}
              className="text-sm"
              disabled={uploadingScript}
            />
          </div>

          {createdPostRef && (
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium text-foreground truncate">
                New draft created: <span className="font-mono font-semibold">{createdPostRef}</span> — {title || "New Video Script"}
              </span>
              {uploadingScript && (
                <span className="inline-flex items-center gap-1 text-blue-600 font-medium shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading script...
                </span>
              )}
            </div>
          )}

          <input
            ref={scriptInputRef}
            type="file"
            accept={ACCEPT_SCRIPT}
            className="hidden"
            onChange={handleScriptFileChange}
          />

          <ScriptStageCard
            submissionId={createdPostId}
            stage={scriptStage.data}
            canEdit={!uploadingScript}
            onAddScript={() => scriptInputRef.current?.click()}
          />

          {!createdPostId && uploadingScript && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating draft and uploading script...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
