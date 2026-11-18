import { format, isValid } from "date-fns";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface Props {
  publishAfterChanges: boolean;
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
  const { publishAfterChanges, videoLocked, resubmitting, hasCheck, checkStale, submitting, publishDate } = props;
  const validDate = publishDate && isValid(publishDate);
  const dateValue = validDate ? format(publishDate, "yyyy-MM-dd'T'HH:mm") : "";
  const label = videoLocked ? "Send Script for Review" : resubmitting
    ? publishAfterChanges ? "Publish" : "Resubmit for Review" : "Send for Review";
  const description = publishAfterChanges
    ? "Your changes will be checked and published directly; they will not return to review."
    : videoLocked ? "Sends your script to the reviewers you picked."
    : !hasCheck ? "You haven't run the compliance check yet. It also runs when you send."
    : checkStale ? "Edited since your last check. It runs again when you send."
    : "Ready when you are. The reviewer sees the same check and analysis.";
  const onDateChange = (value: string) => props.onPublishDateChange(value ? new Date(value) : undefined);

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      {publishAfterChanges && (
        <div className="max-w-md space-y-2">
          <label htmlFor="revision-publish-date" className="block text-sm font-medium">Final publish date and time (required)</label>
          <DateTimePicker id="revision-publish-date" aria-label="Final publish date and time" value={dateValue} onChange={onDateChange} withTime disablePast disabled={props.disabled} />
          <p className="text-xs text-muted-foreground">Confirm or change the intended date before publishing. Times use your local time zone.</p>
          {props.dateError && <p role="alert" className="text-xs text-destructive">Choose a final publish date and time in the future.</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{description}</p>
        <Button type="button" onClick={props.onSubmit} disabled={props.disabled || (publishAfterChanges && !validDate)} className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
