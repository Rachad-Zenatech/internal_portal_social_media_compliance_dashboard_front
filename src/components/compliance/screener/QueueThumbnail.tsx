import { useState } from "react";
import { FileText } from "lucide-react";
import type { ReviewQueueItem } from "@/types/reviewQueue";
import { authedFileUrl } from "@/components/submissions/submissionUi";

/** A simple, recognizable icon for posts without media. */
function TextPostThumbnail() {
  return (
    <div role="img" aria-label="Text post" className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
      <FileText aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
    </div>
  );
}

export default function QueueThumbnail({ s }: { s: ReviewQueueItem }) {
  const image = s.images?.[0];
  const [unavailable, setUnavailable] = useState(false);
  if (s.content_type === "TEXT_POST") return <TextPostThumbnail />;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {unavailable ? (
        <span className="grid h-full w-full place-items-center px-1 text-center text-[9px] leading-tight text-muted-foreground">
          Media unavailable
        </span>
      ) : s.video ? (
        // A frame a second in: many videos open on black.
        <video src={`${authedFileUrl(s.video.url)}#t=1`} preload="metadata" muted onError={() => setUnavailable(true)} className="h-full w-full object-cover" />
      ) : image ? (
        <img src={authedFileUrl(image.url)} alt="" onError={() => setUnavailable(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">Text</span>
      )}
    </div>
  );
}
