import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageSteps } from "@/components/script/ScriptDiff";
import { submissionService } from "@/services/submissionService";
import { scriptService } from "@/services/scriptService";
import type { ScriptStage } from "@/types/script";

const ACCEPT_SCRIPT = ".pdf,.docx,.doc,.txt,.md";

export default function UploadScriptDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (submissionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<ScriptStage | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setFile(selected);
    setUploading(true);
    try {
      let subId = submissionId;
      if (!subId) {
        const postTitle = title.trim() || selected.name.replace(/\.[^/.]+$/, "") || "New Video Script Draft";
        const created = await submissionService.create(postTitle, "VIDEO");
        subId = created.id;
        setSubmissionId(subId);
        if (!title.trim()) setTitle(postTitle);
      }

      await submissionService.uploadFile(subId, "SCRIPT", selected);
      setUploading(false);
      setReading(true);

      // Poll until the script is read
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const currentStage = await scriptService.get(subId);
        setStage(currentStage);
        if (currentStage.file_status === "COMPLETED" || currentStage.file_status === "FAILED") {
          break;
        }
      }
      setReading(false);
      toast.success("Script uploaded and analyzed.");
    } catch (err) {
      setUploading(false);
      setReading(false);
      toast.error(`Couldn't upload script: ${(err as Error).message}`);
    }
  };

  const handleSendForReview = async () => {
    if (!submissionId) return;
    setSubmitting(true);
    try {
      const next = await scriptService.submit(submissionId);
      setStage(next);
      queryClient.invalidateQueries({ queryKey: ["script-queue"] });
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["script", submissionId] });
      toast.success("Script submitted for review!");
      onOpenChange(false);
      if (onSuccess) onSuccess(submissionId);
    } catch (err) {
      toast.error(`Couldn't submit script: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !uploading && !submitting) {
      setSubmissionId(null);
      setFile(null);
      setStage(null);
      setTitle("");
    }
    onOpenChange(nextOpen);
  };

  const hasFile = Boolean(file || stage?.file_name);
  const status = stage?.status ?? "DRAFT";
  const failed = stage?.file_status === "FAILED";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Script for Review</DialogTitle>
          <DialogDescription>
            Submit your script draft before filming. Once approved by a reviewer, you can attach the final video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="script-title" className="text-xs font-medium text-foreground">
              Video Title / Topic
            </Label>
            <Input
              id="script-title"
              placeholder="e.g. ZenaDrone Defense Reconnaissance Demo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
              disabled={uploading || submitting}
            />
          </div>

          {/* Script First Card */}
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-500/30 dark:bg-blue-500/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Script first</p>
              <StageSteps status={status} compact />
            </div>

            {!hasFile ? (
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Video posts start with the script. Upload it (PDF, Word or .txt) and send it for review. It's checked against
                the rulebook, and you can add the video once a reviewer approves it.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-foreground/80">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{file?.name ?? stage?.file_name}</span>
                {uploading ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                  </span>
                ) : reading ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading it...
                  </span>
                ) : failed ? (
                  <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> {stage?.file_error ?? "Couldn't read it. Try a .docx or PDF."}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to send
                  </span>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_SCRIPT}
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || reading || submitting}
              >
                <FileText className="w-3.5 h-3.5" /> {hasFile ? "Replace the script" : "Upload the script"}
              </Button>

              {hasFile && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white"
                  onClick={handleSendForReview}
                  disabled={uploading || reading || failed || submitting}
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send script for review
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
