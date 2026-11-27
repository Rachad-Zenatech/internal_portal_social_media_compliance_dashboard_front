import RevisionCheckRequirements from "@/components/submissions/RevisionCheckRequirements";
import { format } from "date-fns";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PrePublishMood from "@/components/submissions/PrePublishMood";
import PublishPostButton from "@/components/submissions/PublishPostButton";
import { useRevisionPublishing } from "@/hooks/useRevisionPublishing";

export default function RevisionPublishActions(props: {
  submissionId: string | null;
  platform?: string;
  intended?: string | null;
  publishDate?: Date;
  onPublishDateChange: (date: Date | undefined) => void;
  beforeMoodCheck: () => Promise<unknown>;
  onSubmit: () => void;
  disabled: boolean;
  submitting: boolean;
  dateError: boolean;
  requiredChecks?: ("compliance" | "sentiment")[];
  onOpenCheck?: (step: "compliance" | "sentiment") => void;
}) {
  const timing = useRevisionPublishing(props.publishDate, props.intended, props.onSubmit);
  const disabled = props.disabled || !props.submissionId || !props.platform || !timing.validDate || timing.needsConfirmation;
  const when = timing.validDate && props.publishDate ? format(props.publishDate, "EEE, MMM d, yyyy · h:mm a") : "";
  const onDateChange = (value: string) => props.onPublishDateChange(value ? new Date(value) : undefined);
  return (
    <div className="space-y-4">
      {props.submissionId && <PrePublishMood submissionId={props.submissionId} canRun={!props.disabled} beforeCheck={props.beforeMoodCheck} />}
      <RevisionCheckRequirements required={props.requiredChecks ?? []} onOpen={props.onOpenCheck} busy={props.submitting} />
      <div className="space-y-3 border-t border-border/60 pt-3">
        <label htmlFor="revision-publish-date" className="block text-sm font-medium">Final publish date and time (required)</label>
        <p className="text-xs text-muted-foreground">Choose a future publish date and time. You can set this before completing the checks. Times use your local time zone.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><DateTimePicker id="revision-publish-date" aria-label="Final publish date and time" value={timing.value} onChange={onDateChange} withTime disablePast disabled={props.submitting} /></div>
          <PublishPostButton onClick={() => timing.setConfirmOpen(true)} disabled={disabled} busy={props.submitting} />
        </div>
        {timing.usesIntendedDate && <label className="flex items-center gap-2 text-sm"><Checkbox checked={timing.dateConfirmed} onCheckedChange={(checked) => timing.onDateConfirmed(checked === true)} disabled={props.submitting} />Confirm the intended publish date</label>}
        {(props.dateError || !timing.validDate) && <p role="alert" className="text-xs text-destructive">Choose a final publish date and time in the future.</p>}
        <p className="text-xs text-muted-foreground">Your corrected post will be checked and added to the calendar without returning to review.</p>
      </div>
      <AlertDialog open={timing.confirmOpen} onOpenChange={timing.setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm publish</AlertDialogTitle>
            <AlertDialogDescription>Check your corrected post and schedule it for {when}? Calendar publishing is simulated in this browser.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={timing.confirm} disabled={disabled}>Confirm publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
