import type { ReviewQueueItem } from "@/types/submission";

export interface TimelinePart {
  start: number;
  end: number;
  risk: "RED" | "YELLOW" | "GREEN";
}

/** Keep point observations as points; never extend a sampled clear result across unseen footage. */
export function timelineOf(s: Pick<ReviewQueueItem, "latest_check">, duration: number): TimelinePart[] {
  const segments = (s.latest_check?.segment_flags ?? []).filter(segment =>
    Number.isFinite(segment.start_sec) && Number.isFinite(segment.end_sec) && segment.end_sec >= segment.start_sec);
  const total = duration || Math.max(0, ...segments.map(segment => segment.end_sec));
  if (!Number.isFinite(total) || total <= 0) return [];
  const fine = segments.filter(segment => segment.end_sec - segment.start_sec < total * 0.95);
  return (fine.length ? fine : segments)
    .filter(segment => segment.start_sec >= 0 && segment.start_sec <= total)
    .map(segment => ({ start: segment.start_sec, end: Math.min(segment.end_sec, total), risk: segment.traffic_light }))
    .sort((a, b) => a.start - b.start);
}

/** A zero-length observation still needs a visible marker, including at the right edge. */
export function markerStyle(part: TimelinePart, duration: number) {
  const start = Math.max(0, Math.min(part.start, duration));
  const end = Math.max(start, Math.min(part.end, duration));
  return {
    left: `clamp(0px, ${(start / duration) * 100}%, calc(100% - 4px))`,
    width: `max(4px, ${((end - start) / duration) * 100}%)`,
  };
}
