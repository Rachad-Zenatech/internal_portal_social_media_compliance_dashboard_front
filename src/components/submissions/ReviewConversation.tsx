import { useEffect, useRef, useState, type ReactNode } from "react";

import { ConversationImages, ConversationVideo } from "@/components/submissions/ConversationMedia";
import ReviewCommentsPanel from "@/components/submissions/ReviewCommentsPanel";
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
              <ConversationImages submissionId={submissionId} images={images} index={imageIndex} onIndex={setImageIndex} active={active} onActive={setActive} comments={comments} />
            ) : video ? (
              <ConversationVideo
                video={video}
                videoRef={videoRef}
                now={now}
                duration={duration}
                onTime={setNow}
                onDuration={setDuration}
                pinned={pinned}
                active={active}
                onPick={(c) => {
                  setActive(c.id);
                  seek(c.start_sec!);
                }}
              />
            ) : null}
          </div>

          {/* The comments */}
          <div className="min-w-0 lg:max-h-[70vh] lg:overflow-y-auto">{list}</div>
        </div>
      )}
    </div>
  );
}
