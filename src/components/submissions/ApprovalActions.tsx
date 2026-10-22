import { useState } from "react";
import { format, isPast } from "date-fns";
import { CalendarClock, Loader2, MessageSquareWarning, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApprovalActions } from "@/hooks/useReview";

/** The submission fields these actions need (a full Submission or a Content Portal summary). */
export interface ApprovalTarget {
  id: string;
  reference_code: string;
  title: string;
  status: string;
  current_version: number;
  publish_at?: string | null;
  can_manage_approval?: boolean;
}

type Mode = "withdraw" | "reopen" | "reschedule" | null;

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/**
 * What can still happen to approved content before it goes out: its creator withdraws it for a late fix, or a
 * reviewer reschedules it or reopens it for changes. Renders nothing for anyone else or any other status.
 */
export default function ApprovalActions({
  target,
  isCreator,
  buttonClassName = "text-xs gap-1.5",
}: {
  target: ApprovalTarget;
  isCreator: boolean;
  buttonClassName?: string;
}) {
  const { withdraw, reopen, reschedule } = useApprovalActions(target.id, target.reference_code);
  const [mode, setMode] = useState<Mode>(null);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");

  const isReviewer = Boolean(target.can_manage_approval);
  if (target.status !== "APPROVED" || (!isCreator && !isReviewer)) return null;

  const planned = target.publish_at ? new Date(target.publish_at) : null;
  const whenDate = when ? new Date(when) : null;
  const whenInPast = Boolean(whenDate && isPast(whenDate));
  const pending = withdraw.isPending || reopen.isPending || reschedule.isPending;
  const close = () => setMode(null);

  const start = (m: Mode) => {
    setNotes("");
    setWhen(toLocalInput(planned && !isPast(planned) ? planned : new Date(Date.now() + 24 * 3600 * 1000)));
    setMode(m);
  };

  const confirm = () => {
    if (mode === "withdraw") withdraw.mutate(undefined, { onSuccess: close });
    else if (mode === "reopen" && notes.trim()) reopen.mutate(notes.trim(), { onSuccess: close });
    else if (mode === "reschedule" && whenDate && !whenInPast) reschedule.mutate(whenDate.toISOString(), { onSuccess: close });
  };

  return (
    <>
      {isReviewer && (
        <>
          <Button type="button" variant="outline" size="sm" className={buttonClassName} onClick={() => start("reschedule")}>
            <CalendarClock className="w-3.5 h-3.5" /> Reschedule
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${buttonClassName} border-amber-500/40 text-amber-800 hover:bg-amber-500/10 dark:text-amber-200`}
            onClick={() => start("reopen")}
          >
            <MessageSquareWarning className="w-3.5 h-3.5" /> Reopen for changes
          </Button>
        </>
      )}
      {isCreator && (
        <Button type="button" variant="outline" size="sm" className={buttonClassName} onClick={() => start("withdraw")}>
          <RotateCcw className="w-3.5 h-3.5" /> Withdraw to fix
        </Button>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {mode === "withdraw"
                ? `Withdraw ${target.reference_code} to fix it?`
                : mode === "reopen"
                ? `Reopen ${target.reference_code} for changes`
                : `Reschedule ${target.reference_code}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {mode === "withdraw"
                ? `It goes back to draft and comes off the calendar. The approval of version ${target.current_version} no longer applies: once you've made the fix, resubmit it and a reviewer approves it again.`
                : mode === "reopen"
                ? "The approval is taken back and it comes off the calendar. The creator gets your note, makes the changes and resubmits it for review."
                : "The approval stands; only the publish time changes. The creator is told about the new time."}
            </DialogDescription>
          </DialogHeader>

          {mode === "reschedule" && (
            <div className="space-y-1.5">
              <Label htmlFor="approval-when" className="text-xs font-semibold">Publish on</Label>
              <Input id="approval-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="text-xs" />
              {planned && <p className="text-[11px] text-muted-foreground">Currently {format(planned, "EEE MMM d, h:mm a")}.</p>}
              {whenInPast && <p className="text-[11px] text-red-600">Pick a time in the future.</p>}
            </div>
          )}
          {mode === "reopen" && (
            <div className="space-y-1.5">
              <Label htmlFor="approval-notes" className="text-xs font-semibold">What needs to change</Label>
              <Textarea
                id="approval-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
                placeholder="e.g. Legal flagged the availability claim; say it's in testing."
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={`text-xs gap-1.5 text-white ${mode === "reschedule" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}
              disabled={pending || (mode === "reopen" && !notes.trim()) || (mode === "reschedule" && (!whenDate || whenInPast))}
              onClick={confirm}
            >
              {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "withdraw" ? "Withdraw to draft" : mode === "reopen" ? "Reopen for changes" : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
