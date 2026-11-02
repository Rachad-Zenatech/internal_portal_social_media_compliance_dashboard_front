import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ScriptStageCard from "@/components/script/ScriptStageCard";
import { useScriptStage } from "@/hooks/useScript";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";

const ACCEPT_SCRIPT = ".pdf,.docx,.doc,.txt,.md";
const ACCEPT_VIDEO = ".mp4,.mov,.avi,.webm,.mkv,.m4v,video/*";
const NEW_POST_VALUE = "__new__";

export default function UploadScriptDialog({
  open,
  onOpenChange,
  initialSubmissionId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSubmissionId?: string | null;
  onSuccess?: (submissionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canSeeAll = hasPermission("CONTENT_REVIEW_APPROVE") || hasPermission("CONTENT_SUBMISSIONS_DELETE");
  const scriptInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPostId, setSelectedPostId] = useState<string>(initialSubmissionId || "");
  const [title, setTitle] = useState("");
  const [uploadingScript, setUploadingScript] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const submissionsQuery = useQuery({
    queryKey: ["submissions", canSeeAll ? "all" : "mine"],
    queryFn: () => submissionService.list(undefined, canSeeAll ? "all" : "mine"),
    enabled: open,
    staleTime: 0,
  });

  const editableVideoPosts = useMemo(() => {
    const all = submissionsQuery.data ?? [];
    return all.filter(
      (s) =>
        s.content_type === "VIDEO" &&
        (s.status === "DRAFT" || s.status === "CHANGES_REQUESTED")
    );
  }, [submissionsQuery.data]);

  // Default to initialSubmissionId if provided, otherwise the latest editable video post
  useEffect(() => {
    if (!open) return;
    if (initialSubmissionId) {
      setSelectedPostId(initialSubmissionId);
      return;
    }
    if (!selectedPostId && editableVideoPosts.length > 0) {
      setSelectedPostId(editableVideoPosts[0].id);
    } else if (!selectedPostId && !submissionsQuery.isLoading && editableVideoPosts.length === 0) {
      setSelectedPostId(NEW_POST_VALUE);
    }
  }, [open, initialSubmissionId, selectedPostId, editableVideoPosts, submissionsQuery.isLoading]);

  const activeSubId =
    selectedPostId && selectedPostId !== NEW_POST_VALUE ? selectedPostId : null;

  const scriptStage = useScriptStage(activeSubId, open && Boolean(activeSubId));
  const selectedPost = useMemo(
    () => (submissionsQuery.data ?? []).find((s) => s.id === activeSubId) ?? null,
    [submissionsQuery.data, activeSubId]
  );

  // Close dialog automatically when script status transitions to IN_REVIEW after clicking "Send script for review"
  const prevStatusRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const current = scriptStage.data?.status;
    if (
      prevStatusRef.current &&
      prevStatusRef.current !== "IN_REVIEW" &&
      current === "IN_REVIEW" &&
      activeSubId
    ) {
      if (onSuccess) onSuccess(activeSubId);
      onOpenChange(false);
    }
    prevStatusRef.current = current;
  }, [scriptStage.data?.status, activeSubId, onSuccess, onOpenChange]);

  const handleScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;

    setUploadingScript(true);
    try {
      let subId = activeSubId;
      if (!subId) {
        const postTitle =
          title.trim() ||
          selected.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ") ||
          "New Video Script";
        const created = await submissionService.create(postTitle, "VIDEO");
        subId = created.id;
        setSelectedPostId(subId);
        if (!title.trim()) setTitle(postTitle);
      }

      await submissionService.uploadFile(subId, "SCRIPT", selected);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["script", subId] }),
        queryClient.invalidateQueries({ queryKey: ["submission", subId] }),
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
      ]);
      toast.success(`Uploaded ${selected.name} to post.`);
    } catch (err) {
      toast.error(`Couldn't upload script: ${(err as Error).message}`);
    } finally {
      setUploadingScript(false);
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected || !activeSubId) return;

    setUploadingVideo(true);
    try {
      await submissionService.uploadFile(activeSubId, "MAIN", selected);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["submission", activeSubId] }),
        queryClient.invalidateQueries({ queryKey: ["submissions"] }),
        queryClient.invalidateQueries({ queryKey: ["review-queue"] }),
      ]);
      toast.success(`Attached video ${selected.name} to post.`);
      if (onSuccess) onSuccess(activeSubId);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Couldn't upload video: ${(err as Error).message}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !uploadingScript && !uploadingVideo) {
      prevStatusRef.current = undefined;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload Script for Post</DialogTitle>
          <DialogDescription>
            Update your video post with its script (PDF, Word or .txt) and send it for review using the post's script stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="script-post-select" className="text-xs font-medium text-foreground">
              Post to update
            </Label>
            <Select
              value={selectedPostId || NEW_POST_VALUE}
              onValueChange={(v) => setSelectedPostId(v)}
              disabled={uploadingScript || uploadingVideo}
            >
              <SelectTrigger id="script-post-select" className="w-full text-sm">
                <SelectValue placeholder="Select a video post to update" />
              </SelectTrigger>
              <SelectContent>
                {editableVideoPosts.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.reference_code} · {p.title}
                    {p.script_status ? ` (Script: ${p.script_status.replace("_", " ").toLowerCase()})` : ""}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_POST_VALUE} className="text-xs font-medium text-blue-700 dark:text-blue-400">
                  + Create a new video post draft
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedPostId === NEW_POST_VALUE && (
            <div className="space-y-1.5">
              <Label htmlFor="script-title" className="text-xs font-medium text-foreground">
                Video Post Title
              </Label>
              <Input
                id="script-title"
                placeholder="e.g. Shaun Instagram Reels - AV Scripts"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm"
                disabled={uploadingScript}
              />
            </div>
          )}

          {selectedPost && (
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium text-foreground truncate">
                Updating <span className="font-mono font-semibold">{selectedPost.reference_code}</span> — {selectedPost.title}
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
          <input
            ref={videoInputRef}
            type="file"
            accept={ACCEPT_VIDEO}
            className="hidden"
            onChange={handleVideoFileChange}
          />

          {/* Exact same ScriptStageCard used on the post */}
          <ScriptStageCard
            submissionId={activeSubId}
            stage={scriptStage.data}
            canEdit={!uploadingScript}
            onAddScript={() => scriptInputRef.current?.click()}
          />

          {/* Once the script is approved, allow uploading the video directly onto the updated post */}
          {scriptStage.data?.status === "APPROVED" && activeSubId && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3.5">
              <div className="text-xs">
                <p className="font-semibold text-foreground">Attach video to {selectedPost?.reference_code ?? "this post"}</p>
                <p className="text-muted-foreground">Upload the filmed video (MP4, MOV, WEBM) directly to this post.</p>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shrink-0"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploadingVideo}
              >
                {uploadingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload video
              </Button>
            </div>
          )}

          {!activeSubId && uploadingScript && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating draft and uploading script...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
