import PendingDismissalScore from "@/components/submissions/PendingDismissalScore";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import RevisionPublishActions from "@/components/submissions/RevisionPublishActions";
import { useReviewSendScore } from "@/hooks/useReviewSendScore";
import type { StoredCheck } from "@/types/submission";

interface Props {
  publishAfterChanges: boolean;
  submissionId: string | null;
  platform?: string;
  intended?: string | null;
  beforeMoodCheck: () => Promise<unknown>;
  videoLocked: boolean;
  resubmitting: boolean;
  hasCheck: boolean;
  checkStale: boolean;
  score?: number;
  check?: StoredCheck | null;
  currentVersion: number;
  minimumScore: number;
  submitting: boolean;
  disabled: boolean;
  publishDate?: Date;
  dateError: boolean;
  onPublishDateChange: (date: Date | undefined) => void;
  onSubmit: () => void;
}

/** The final action, including timing for reviewer-authorized direct publishing. */
export default function SubmissionSendActions(props: Props) {
  const { publishAfterChanges, videoLocked, resubmitting, hasCheck, checkStale, submitting } = props;
  const pendingScore = useReviewSendScore(props.submissionId, props.check, props.currentVersion);
  if (publishAfterChanges) return <RevisionPublishActions {...props} />;
  const label = videoLocked ? "Send Script for Review" : resubmitting
    ? "Resubmit for Review" : "Send for Review";
  const pendingReview = props.score != null && props.score < props.minimumScore && pendingScore != null && pendingScore >= props.minimumScore;
  const scoreTooLow = !videoLocked && !checkStale && props.score != null && props.score < props.minimumScore && !pendingReview;
  const description = scoreTooLow ? `Your compliance score is ${props.score}/100. Sending for review requires at least ${props.minimumScore}.`
    : pendingReview ? `Your score remains ${props.score}/100. Send for review so a reviewer can decide your dismissal requests; approval still requires ${props.minimumScore}.`
    : videoLocked ? "Sends your script to the reviewers you picked."
    : !hasCheck ? "You haven't run the compliance check yet. It also runs when you send."
    : checkStale ? "Edited since your last check. It runs again when you send."
    : "Ready when you are. The reviewer sees the same check and analysis.";

  const recalculatedScore = !checkStale && !videoLocked ? pendingScore : undefined;
  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <PendingDismissalScore originalScore={props.score ?? 0} recalculatedScore={recalculatedScore} minimumScore={props.minimumScore} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{description}</p>
        <Button type="button" onClick={props.onSubmit} disabled={props.disabled || scoreTooLow} className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
