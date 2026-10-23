import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCcw, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFlagReviews } from "@/hooks/useReview";
import type { FlagDismissReason } from "@/types/submission";

const REASONS: { value: FlagDismissReason; label: string; hint: string }[] = [
  { value: "NEGATED", label: "Says the opposite", hint: 'e.g. "not combat proven"' },
  { value: "DIFFERENT_MEANING", label: "Different meaning", hint: 'e.g. "an army of volunteers"' },
  { value: "ACCEPTABLE_IN_CONTEXT", label: "Acceptable in context", hint: "The wording is fine here" },
  { value: "RULE_TOO_BROAD", label: "Rule is too broad", hint: "The phrase catches too much; the rule needs fixing" },
  { value: "OTHER", label: "Other", hint: "Say why below" },
];

/**
 * A reviewer's call on one automated flag: dismiss it as a false alarm with a reason, or undo that. The score
 * isn't changed; the dismissal is recorded beside it and counts toward the rule's noise on the rulebook.
 */
export default function FlagReviewControl({
  submissionId,
  ruleId,
  ruleNumber,
  currentVersion,
  canDismiss,
}: {
  submissionId: string;
  /** The version in review; dismissals belong to one version. */
  currentVersion: number;
  ruleId: string;
  ruleNumber: string;
  /** A reviewer looking at the version in review. */
  canDismiss: boolean;
}) {
  const { forCurrent, dismiss, restore } = useFlagReviews(submissionId, currentVersion);
  const review = forCurrent.get(ruleId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagDismissReason>("NEGATED");
  const [note, setNote] = useState("");

  if (review) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
        <ShieldOff className="w-3.5 h-3.5" />
        <span>
          <span className="font-semibold text-foreground">Dismissed</span> by {review.decided_by_name ?? "a reviewer"} ·{" "}
          {review.reason_label}
          {review.note ? `: "${review.note}"` : ""} · {formatDistanceToNow(new Date(review.decided_at), { addSuffix: true })}
        </span>
        {canDismiss && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline disabled:opacity-60 dark:text-blue-300"
            disabled={restore.isPending}
            onClick={() => restore.mutate(ruleId)}
          >
            <RotateCcw className="w-3 h-3" /> Undo
          </button>
        )}
      </div>
    );
  }
  if (!canDismiss) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setReason("NEGATED");
          setNote("");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ShieldOff className="w-3.5 h-3.5" /> Dismiss as false alarm
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base">Dismiss the {ruleNumber} flag?</DialogTitle>
            <DialogDescription className="text-xs">
              The score stays as the rulebook found it; your call is recorded beside it with the reason, and counts toward how
              noisy this rule is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Why doesn't it apply?</Label>
              <div className="space-y-1">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 px-2.5 py-1.5 text-xs has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/60 dark:has-[:checked]:bg-blue-500/10">
                    <input type="radio" name="dismiss-reason" className="mt-0.5 accent-current" checked={reason === r.value} onChange={() => setReason(r.value)} />
                    <span>
                      <span className="font-semibold text-foreground">{r.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dismiss-note" className="text-xs font-semibold">
                Note {reason === "OTHER" ? "" : "(optional)"}
              </Label>
              <Textarea id="dismiss-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
              disabled={dismiss.isPending || (reason === "OTHER" && !note.trim())}
              onClick={() => dismiss.mutate({ ruleId, reason, note: note.trim() || null }, { onSuccess: () => setOpen(false) })}
            >
              {dismiss.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Dismiss flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
