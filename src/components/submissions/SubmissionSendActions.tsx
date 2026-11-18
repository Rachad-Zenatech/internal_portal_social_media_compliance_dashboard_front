import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import RevisionPublishActions from "@/components/submissions/RevisionPublishActions";

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
  if (publishAfterChanges) return <RevisionPublishActions {...props} />;
  const label = videoLocked ? "Send Script for Review" : resubmitting
    ? "Resubmit for Review" : "Send for Review";
  const description = videoLocked ? "Sends your script to the reviewers you picked."
    : !hasCheck ? "You haven't run the compliance check yet. It also runs when you send."
    : checkStale ? "Edited since your last check. It runs again when you send."
    : "Ready when you are. The reviewer sees the same check and analysis.";

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{description}</p>
        <Button type="button" onClick={props.onSubmit} disabled={props.disabled} className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
