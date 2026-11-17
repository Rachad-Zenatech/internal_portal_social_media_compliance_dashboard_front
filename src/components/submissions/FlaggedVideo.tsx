import type { RefObject } from "react";

import MediaFindingOverlay from "@/components/submissions/MediaFindingOverlay";
import type { ComplianceViolation } from "@/services/complianceService";

/** Video frame with the compliance checker’s yellow finding boxes. */
export default function FlaggedVideo({
  src,
  fileId,
  videoRef,
  findings,
  currentTime,
  onTime,
  onDuration,
  onPlaying,
}: {
  src: string;
  fileId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  findings: ComplianceViolation[];
  currentTime: number;
  onTime: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
        onPlay={() => onPlaying(true)}
        onPause={() => onPlaying(false)}
        className="max-h-[420px] w-full rounded-xl bg-black"
      />
      <MediaFindingOverlay findings={findings} fileId={fileId} currentTime={currentTime} showRuleTooltip />
    </div>
  );
}
