import { useEffect, useRef, useState, type ReactNode } from "react";

import ImageAnnotator from "@/components/submissions/ImageAnnotator";
import ReviewCommentsPanel, { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { useReviewComments } from "@/hooks/useReview";
import type { SubmissionFile } from "@/types/submission";

/**
 * The review conversation for the creator, as the reviewer saw it: the post's image (or video) on the left with each
 * comment's area marked, the comments on the right. Clicking a comment shows its area (or jumps to its moment), and
 * clicking an area picks its comment.
 */
export default function ReviewConversation({
  submissionId,
  files,
  canReply,
  header,
  emptyText,
}: {
  submissionId: string;
  files: SubmissionFile[];
  /** Sent back: the creator can reply. Approved: read-only. */
  canReply: boolean;
  header?: ReactNode;
  emptyText?: string;
}) {
  const { comments } = useReviewComments(submissionId);
  const images = files.filter((f) => (f.kind === "MAIN" || f.kind === "IMAGE") && f.mime_type.startsWith("image/"));
  const video = files.find((f) => f.kind === "MAIN" && f.mime_type.startsWith("video/"));
  const [active, setActive] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const image = images[Math.min(imageIndex, Math.max(0, images.length - 1))];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const pinned = comments.filter((c) => c.start_sec != null);
  const seek = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = sec;
    v.pause();
    setNow(sec);
  };

  // A comment picked in the list brings up the image it is on.
  useEffect(() => {
    const c = comments.find((x) => x.id === active);
    const at = c?.file_id ? images.findIndex((i) => i.id === c.file_id) : -1;
    if (at >= 0) setImageIndex(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const hasMedia = Boolean(image || video);
  const areasOn = (fileId: string) => comments.filter((c) => c.file_id === fileId && c.region_w != null && !c.resolved_at).length;

  const list = (
    <ReviewCommentsPanel
      submissionId={submissionId}
      canComment={canReply}
      showHeader={false}
      showComposer={canReply}
      currentTime={video ? now : undefined}
      onSeek={video ? seek : undefined}
      activeCommentId={active}
      onShowRegion={(c) => {
        setActive(active === c.id ? null : c.id);
        if (c.start_sec != null) seek(c.start_sec);
      }}
      placeholder="Reply to the reviewer..."
      emptyText={emptyText}
    />
  );

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card px-5 py-4">
      {header}
      {!hasMedia ? (
        list
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
          {/* The post, with where each comment is */}
          <div className="flex min-w-0 flex-col gap-2">
            {image ? (
              <>
                <div className="grid place-items-center rounded-xl bg-muted p-2">
                  <ImageAnnotator
                    key={image.id}
                    submissionId={submissionId}
                    file={image}
                    canDraw={false}
                    activeId={active}
                    onActive={setActive}
                    imageClassName="max-h-[60vh] w-auto rounded-xl object-contain"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, i) => {
                      const n = areasOn(img.id);
                      return (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setImageIndex(i)}
                          aria-label={`Image ${i + 1}${n ? `, ${n} open comment${n === 1 ? "" : "s"}` : ""}`}
                          className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 ${i === imageIndex ? "border-blue-600" : "border-transparent opacity-70 hover:opacity-100"}`}
                        >
                          <img src={authedFileUrl(img.url)} alt="" className="h-full w-full object-cover" />
                          {n > 0 && (
                            <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                              {n}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Click a numbered box or a comment to see where it is.</p>
              </>
            ) : video ? (
              <>
                <video
                  ref={videoRef}
                  src={authedFileUrl(video.url)}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[60vh] w-full rounded-xl bg-black"
                  onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                />
                {duration > 0 && pinned.length > 0 && (
                  <div className="relative h-5 rounded bg-muted" aria-label="Where the comments are in the video">
                    <div className="absolute inset-y-0 left-0 rounded bg-blue-600/15" style={{ width: `${Math.min(100, (now / duration) * 100)}%` }} />
                    {pinned.map((c) => {
                      const left = Math.min(100, (c.start_sec! / duration) * 100);
                      const width = c.end_sec != null && c.end_sec > c.start_sec! ? Math.max(1.5, ((c.end_sec - c.start_sec!) / duration) * 100) : 0;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setActive(c.id);
                            seek(c.start_sec!);
                          }}
                          title={`${formatSec(c.start_sec!)} · ${c.body}`}
                          aria-label={`Comment at ${formatSec(c.start_sec!)}`}
                          className={`absolute bottom-0.5 top-0.5 rounded-sm ${
                            c.id === active ? "bg-blue-600 ring-2 ring-blue-300" : c.resolved_at ? "bg-muted-foreground/40" : "bg-blue-500/70 hover:bg-blue-600"
                          }`}
                          style={{ left: `${left}%`, width: width ? `${width}%` : "6px", marginLeft: width ? 0 : -3 }}
                        />
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Click a mark on the bar or a comment to jump to its moment.</p>
              </>
            ) : null}
          </div>

          {/* The comments */}
          <div className="min-w-0 lg:max-h-[70vh] lg:overflow-y-auto">{list}</div>
        </div>
      )}
    </div>
  );
}
