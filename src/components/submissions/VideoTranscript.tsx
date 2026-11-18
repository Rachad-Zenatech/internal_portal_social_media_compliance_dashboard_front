import { statusOf } from "@/components/submissions/FindingStatus";
import { formatSec } from "@/components/submissions/ReviewCommentsPanel";
import type { StoredCheck, SubmissionFile } from "@/types/submission";

export default function VideoTranscript({ file, check, now, seek, fullHeight = false }: {
  file: SubmissionFile;
  check: StoredCheck | null;
  now: number;
  seek: (time: number) => void;
  fullHeight?: boolean;
}) {
  const segments = [...(file.transcript ?? [])].sort((a, b) => a.start_sec - b.start_sec);
  const criticalFindings = check?.violations.filter((finding) =>
    finding.traffic_light === "RED" && statusOf(finding) !== "CLEARED"
  ) ?? [];
  const criticalFlags = check?.segment_flags?.filter((flag) => flag.traffic_light === "RED") ?? [];
  const rows = segments.map((segment, index) => {
    const matchingFlags = criticalFlags.filter((flag) =>
      flag.start_sec === segment.start_sec && flag.end_sec === segment.end_sec
    );
    const critical = criticalFindings.filter((finding) =>
      matchingFlags.some((flag) => flag.rule_numbers.includes(finding.rule_number))
    );
    const active = now >= segment.start_sec && now < segment.end_sec;
    const tone = critical.length
      ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
      : active ? "border-border bg-muted" : "border-transparent hover:bg-muted";

    return (
      <li key={`${segment.start_sec}-${index}`}>
        <button type="button" onClick={() => seek(segment.start_sec)} aria-current={active || undefined}
          className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left ${tone}`}>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatSec(segment.start_sec)}</span>
          <span className="min-w-0 break-words text-[13px] leading-relaxed">
            {critical.map((finding) => (
              <strong key={`${finding.rule_id}-${finding.kind ?? ""}`} className="block text-xs text-red-700 dark:text-red-300">
                Critical · Rule {finding.rule_number} · {finding.title}
              </strong>
            ))}
            {segment.source === "on_screen" && <span className="mr-1 text-xs text-muted-foreground">[on screen]</span>}
            {segment.text}
          </span>
        </button>
      </li>
    );
  });
  const emptyMessage = {
    PENDING: "The system is preparing the transcript…",
    PROCESSING: "The system is preparing the transcript…",
    FAILED: "The system couldn’t generate a transcript for this video.",
    COMPLETED: "No speech or on-screen text was detected.",
  };

  const listClass = fullHeight ? "space-y-1" : "max-h-64 space-y-1 overflow-y-auto";
  const sectionClass = fullHeight ? "space-y-4 rounded-xl border border-border bg-card p-4" : "space-y-3 border-t border-border/70 pt-3";
  const message = file.transcript_status ? emptyMessage[file.transcript_status] : "No transcript is available for this video.";
  return (
    <section aria-label="Video transcript" className={sectionClass}>
      <header>
        <h3 className="text-sm font-semibold text-foreground">Video transcript</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Read what is said and shown in the video. Select a line to jump to that moment.</p>
      </header>
      {rows.length ? <ol aria-label="Transcript lines" className={listClass}>{rows}</ol> : <p role="status" className="text-[13px] text-muted-foreground">{message}</p>}
    </section>
  );
}
