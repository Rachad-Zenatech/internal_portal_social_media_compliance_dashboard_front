import PostApprovalSuggestionNotice from "./PostApprovalSuggestionNotice";
import { useApprovedPostAccess } from "@/hooks/usePostApprovalSuggestions";
import { useId } from "react";
import { format } from "@/lib/userDates";
import { Link } from "react-router-dom";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PublishPostButton from "@/components/submissions/PublishPostButton";
import { useApprovedPublishing } from "@/hooks/useApprovedPublishing";

/** Confirm the creator's final timing before leaving an approved post to publish. */
export default function ApprovedPublishActions({ submissionId, platform, intended }: {
  submissionId: string;
  platform?: string;
  intended?: string | null;
}) {
  const id = useId();
  const { finalDate, scheduled, confirmOpen, setConfirmOpen, confirm, usesIntendedDate, dateConfirmed, needsDateConfirmation, onDateConfirmed } = useApprovedPublishing(submissionId, intended);
  const suggestions = useApprovedPostAccess(submissionId);
  const disabled = suggestions.isLoading || suggestions.isError || suggestions.publishingBlocked || !platform || Boolean(finalDate.error) || Boolean(scheduled) || Boolean(needsDateConfirmation);
  const when = finalDate.date ? format(finalDate.date, "EEE, MMM d, yyyy · h:mm a") : "";

  return (
    <div className="w-full space-y-3">
      <PostApprovalSuggestionNotice access={suggestions} />
      <label htmlFor={id} className="block text-sm font-medium">Final publish date and time (required)</label>
      <p className="text-xs text-muted-foreground">{intended ? "Confirm the intended publish date below, or change it before publishing." : "No intended publish date is set. Choose the final publish date before publishing."} Times use your local time zone.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><DateTimePicker id={id} aria-label="Final publish date and time" value={finalDate.value} onChange={finalDate.onChange} withTime disablePast disabled={Boolean(scheduled) || suggestions.publishingBlocked} /></div>
        <PublishPostButton onClick={() => setConfirmOpen(true)} disabled={disabled} label={scheduled ? "Added to calendar" : "Publish post"} />
      </div>
      {usesIntendedDate && !scheduled && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dateConfirmed} onCheckedChange={(checked) => onDateConfirmed(checked === true)} />
          Confirm the intended publish date
        </label>
      )}
      {finalDate.error && <p role="alert" className="text-xs text-destructive">{finalDate.error}</p>}
      {scheduled && <p role="status" className="text-sm">Scheduled for {when}. <Button asChild variant="link" className="h-auto p-0"><Link to={`/content-calendar?date=${encodeURIComponent(scheduled)}&post=sub-${submissionId}`}>View on calendar</Link></Button></p>}
      {!platform && <p role="alert" className="text-xs text-destructive">A publishing platform must be selected for this post.</p>}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm publish</AlertDialogTitle>
            <AlertDialogDescription>Add this approved post to the calendar for {when}? Publishing is simulated in this browser.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>Confirm publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
