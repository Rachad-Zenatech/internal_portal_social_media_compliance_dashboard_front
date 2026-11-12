import { useRef, useState } from "react";
import { ArrowRight, FileText, Loader2, PenLine, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ImageAnnotator from "@/components/submissions/ImageAnnotator";
import ReviewCommentsPanel, { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import { authedFileUrl, dueInfo } from "@/components/submissions/submissionUi";
import { useReviewComments } from "@/hooks/useReview";
import type { SubmissionFile } from "@/types/submission";

/**
 * What the uploader sees after a reviewer asks for changes: the content and the reviewer's comments side by
 * side. A comment's time jumps the player to that moment; the main file can be swapped in one click.
 */
export default function RevisionWorkspace({
  submissionId,
  dueAt,
  mainFile,
  caption,
  accept,
  replacing,
  submitting,
  onReplace,
  onEditCaption,
  onDone,
}: {
  submissionId: string;
  /** Resubmit-by date for the requested changes. */
  dueAt?: string | null;
  mainFile?: SubmissionFile;
  caption: string;
  /** File types the main upload accepts. */
  accept: string;
  replacing: boolean;
  submitting: boolean;
  onReplace: (file: File) => void;
  onEditCaption: () => void;
  /** The changes are made: save and go on to run the checks again. */
  onDone: () => void;
}) {
  const { comments } = useReviewComments(submissionId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // The area of the image a reviewer commented on, picked here or in the list.
  const [activeComment, setActiveComment] = useState<string | null>(null);

  const open = comments.filter((c) => !c.resolved_at).length;
  const due = dueInfo(dueAt, "REVISION");
  const isVideo = mainFile?.mime_type.startsWith("video/");
  const isImage = mainFile?.mime_type.startsWith("image/");
  const pinned = comments.filter((c) => c.start_sec != null);

  const seek = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = sec;
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
    void v.play().catch(() => undefined);
  };

  return (
    <Card className="py-0 gap-0 border-border/80 shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-border/70">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">The reviewer's comments</p>
          <p className="text-xs text-muted-foreground">
            {open > 0 ? `${open} open comment${open === 1 ? "" : "s"}. ` : "All comments resolved. "}
            Click a comment to see where it is on the post, then fix it here. When you're done, run the checks again.
          </p>
          {due && (
            <p className={`mt-1 text-xs font-semibold ${due.overdue ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>
              {due.overdue ? `Overdue: this was due ${due.exact}. Resubmit as soon as you can.` : `Resubmit by ${due.exact} (${due.text.toLowerCase()}).`}
            </p>
          )}
        </div>
        <Button size="sm" onClick={onDone} disabled={submitting || replacing} className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Done: run the checks again
          {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Content */}
        <div className="space-y-3 min-w-0">
          <div className="rounded-lg border border-border/80 bg-black/90 overflow-hidden">
            {replacing ? (
              <div className="aspect-video flex items-center justify-center gap-2 text-xs text-white/80">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading the new file...
              </div>
            ) : isVideo ? (
              <video
                key={mainFile!.id}
                ref={videoRef}
                src={authedFileUrl(mainFile!.url)}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-[420px] bg-black"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              />
            ) : isImage ? (
              <div className="flex justify-center bg-muted p-2">
                <ImageAnnotator submissionId={submissionId} file={mainFile!} canDraw={false} activeId={activeComment} onActive={setActiveComment} imageClassName="max-h-[420px] w-auto object-contain" />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center gap-2 text-xs text-white/70">
                <FileText className="w-4 h-4" /> {mainFile ? mainFile.original_name : "No main file attached."}
              </div>
            )}
          </div>

          {/* Where the comments are, on the video's timeline */}
          {isVideo && duration > 0 && pinned.length > 0 && (
            <div>
              <div className="relative h-5 rounded bg-muted">
                <div className="absolute inset-y-0 left-0 rounded bg-primary/15" style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }} />
                {pinned.map((c) => {
                  const left = Math.min(100, (c.start_sec! / duration) * 100);
                  const width = c.end_sec != null && c.end_sec > c.start_sec! ? Math.max(1.5, ((c.end_sec - c.start_sec!) / duration) * 100) : 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => seek(c.start_sec!)}
                      title={`${formatSec(c.start_sec!)} · ${c.body}`}
                      aria-label={`Jump to comment at ${formatSec(c.start_sec!)}`}
                      className={`absolute top-0.5 bottom-0.5 rounded-sm ${c.resolved_at ? "bg-muted-foreground/40" : "bg-blue-500/70 hover:bg-blue-600"}`}
                      style={{ left: `${left}%`, width: width ? `${width}%` : "6px", marginLeft: width ? 0 : -3 }}
                    />
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Blue marks are open comments, grey are resolved. Click one to jump there.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs font-semibold" disabled={replacing} onClick={() => inputRef.current?.click()}>
              <RefreshCw className="w-3.5 h-3.5" /> {mainFile ? `Replace ${isVideo ? "video" : isImage ? "image" : "file"}` : "Upload file"}
            </Button>
            {mainFile && <span className="text-[11px] text-muted-foreground truncate min-w-0">{mainFile.original_name}</span>}
          </div>

          <div className="rounded-lg border border-border/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">Caption / copy</p>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onEditCaption}>
                <PenLine className="w-3.5 h-3.5" /> Edit caption
              </Button>
            </div>
            <p className="text-xs text-foreground whitespace-pre-wrap break-words line-clamp-6">
              {caption.trim() || <span className="text-muted-foreground">No caption.</span>}
            </p>
          </div>
        </div>

        {/* Comments */}
        <div className="min-w-0 lg:max-h-[640px] lg:overflow-y-auto">
          <ReviewCommentsPanel
            submissionId={submissionId}
            canComment
            currentTime={isVideo ? currentTime : undefined}
            onSeek={isVideo ? seek : undefined}
            activeCommentId={activeComment}
            onShowRegion={(c) => {
              setActiveComment(activeComment === c.id ? null : c.id);
              if (c.start_sec != null) seek(c.start_sec);
            }}
            placeholder="Reply to the reviewer..."
          />
        </div>
      </div>
    </Card>
  );
}
