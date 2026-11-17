import SentimentPanel from "@/components/submissions/SentimentPanel";
import type { SentimentFinding } from "@/types/sentiment";

/** The expanded sentiment view shared by reviewer-facing screens. */
export default function ReviewerSentimentPanel({
  submissionId,
  version,
  canRun,
  onSeek,
  onApplyRevision,
  showTopicTrends = true,
}: {
  submissionId: string;
  version?: number;
  canRun?: boolean;
  onSeek?: (sec: number) => void;
  onApplyRevision?: (finding: SentimentFinding) => boolean;
  showTopicTrends?: boolean;
}) {
  return (
    <SentimentPanel
      submissionId={submissionId}
      version={version}
      canRun={canRun}
      onSeek={onSeek}
      onApplyRevision={onApplyRevision}
      showTopicTrends={showTopicTrends}
      design
    />
  );
}
