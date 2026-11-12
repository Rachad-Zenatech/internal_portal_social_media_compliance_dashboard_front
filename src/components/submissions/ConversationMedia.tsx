import type { RefObject } from "react";

import ImageAnnotator from "@/components/submissions/ImageAnnotator";
import { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import type { ReviewComment, SubmissionFile } from "@/types/submission";

/** The post's image with each comment's area marked, and thumbnails (with their open-comment counts) for a carousel. */
export function ConversationImages({
  submissionId,
  images,
  index,
  onIndex,
  active,
  onActive,
  comments,
}: {
  submissionId: string;
  images: SubmissionFile[];
  index: number;
  onIndex: (i: number) => void;
  active: string | null;
  onActive: (id: string | null) => void;
  comments: ReviewComment[];
}) {
  const image = images[Math.min(index, Math.max(0, images.length - 1))];
  const areasOn = (fileId: string) => comments.filter((c) => c.file_id === fileId && c.region_w != null && !c.resolved_at).length;
  return (
    <>
      <div className="grid place-items-center rounded-xl bg-muted p-2">
        <ImageAnnotator
          key={image.id}
          submissionId={submissionId}
          file={image}
          canDraw={false}
          activeId={active}
          onActive={onActive}
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
                onClick={() => onIndex(i)}
                aria-label={`Image ${i + 1}${n ? `, ${n} open comment${n === 1 ? "" : "s"}` : ""}`}
                className={`relative h-14 w-14 overflow-hidden rounded-lg border-2 ${i === index ? "border-blue-600" : "border-transparent opacity-70 hover:opacity-100"}`}
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
  );
}

/** The post's video, with a bar marking where each comment is. */
export function ConversationVideo({
  video,
  videoRef,
  now,
  duration,
  onTime,
  onDuration,
  pinned,
  active,
  onPick,
}: {
  video: SubmissionFile;
  videoRef: RefObject<HTMLVideoElement | null>;
  now: number;
  duration: number;
  onTime: (t: number) => void;
  onDuration: (d: number) => void;
  pinned: ReviewComment[];
  active: string | null;
  onPick: (c: ReviewComment) => void;
}) {
  return (
    <>
      <video
        ref={videoRef}
        src={authedFileUrl(video.url)}
        controls
        playsInline
        preload="metadata"
        className="max-h-[60vh] w-full rounded-xl bg-black"
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => onDuration(e.currentTarget.duration || 0)}
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
                onClick={() => onPick(c)}
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
  );
}
