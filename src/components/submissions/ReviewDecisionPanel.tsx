import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { AlertTriangle, CalendarPlus, Check, FilePen, Loader2, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReviewComments, useReviewDecision } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { DueKind, ReviewJob } from "@/types/submission";
import { DueBadge } from "@/components/submissions/submissionUi";
import RevisionTimelinePicker, { type RevisionDays } from "@/components/submissions/RevisionTimelinePicker";

/** The submission fields the review controls need (works for a full Submission or a queue item). */
export interface ReviewTarget {
  id: string;
  reference_code: string;
  title: string;
  status: string;
  current_version: number;
  platforms: string[];
  publish_at?: string | null;
  due_at?: string | null;
  due_kind?: DueKind | null;
  can_review?: boolean;
  /** False when final approval is with someone else (see approver_names). Defaults to allowed. */
  can_approve?: boolean;
  approver_names?: string[];
  /** Critical flags nobody has dismissed: approving waits until they're fixed or dismissed. */
  open_critical_flags?: number;
  /** The score counting only flags nobody has dismissed; approving waits until it reaches min_approval_score. */
  approval_score?: number | null;
  min_approval_score?: number;
  score?: number | null;
  /** Rules the automated check can't test from text; the reviewer confirms each one when approving. */
  manual_rules?: { rule_number: string; title: string }[];
}

type Mode = "schedule" | "now" | "changes" | null;

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

/** Default schedule time: the creator's planned time if it's still ahead, otherwise this time tomorrow. */
function defaultPublishTime(planned: Date | null) {
  return planned && !isPast(planned) ? planned : new Date(Date.now() + 24 * 3600 * 1000);
}

/**
 * The reviewer's decision for the version in review: approve it onto the calendar, approve and publish now, or
 * send it back with what to change. Only shown to reviewers who may decide on this item.
 */
export default function ReviewDecisionPanel({
  target,
  compact = false,
  layout = "panel",
}: {
  target: ReviewTarget;
  compact?: boolean;
  /** "bar": only the buttons (stacked for a narrow side panel). "inline": only the buttons, in one wrapping row
   * (the Content Portal's approval footer). Both use the same confirm dialog. */
  layout?: "panel" | "bar" | "inline";
}) {
  const openCritical = target.open_critical_flags ?? 0;
  const minScore = target.min_approval_score ?? 70;
  const approvalScore = target.approval_score ?? null;
  // Shown once critical flags are dealt with, since those come first (and cap the score anyway).
  const scoreTooLow = openCritical === 0 && approvalScore != null && approvalScore < minScore;
  const mayApprove = target.can_approve !== false && openCritical === 0 && !scoreTooLow;
  const navigate = useNavigate();
  const decide = useReviewDecision(target.id, target.reference_code);
  const { creatorView } = useAuth();
  const { comments } = useReviewComments(target.id);
  const openComments = comments.filter((c) => !c.resolved_at && c.version_number === target.current_version).length;
  const [mode, setMode] = useState<Mode>(null);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [revisionDays, setRevisionDays] = useState<RevisionDays>(1);

  // Not a reviewer here, or a super admin viewing the app as a creator.
  if (!target.can_review || creatorView) return null;

  const manualRules = target.manual_rules ?? [];
  const allConfirmed = manualRules.every((r) => confirmed.has(r.rule_number));
  const planned = target.publish_at ? new Date(target.publish_at) : null;
  const start = (m: Mode) => {
    setNotes("");
    setWhen(toLocalInput(defaultPublishTime(planned)));
    setConfirmed(new Set());
    setRevisionDays(1);
    setMode(m);
  };
  const toggleConfirmed = (ruleNumber: string) =>
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(ruleNumber)) next.delete(ruleNumber);
      else next.add(ruleNumber);
      return next;
    });
  const whenDate = when ? new Date(when) : null;
  const whenInPast = Boolean(whenDate && isPast(whenDate));
  const confirmedRules = manualRules.map((r) => r.rule_number).filter((n) => confirmed.has(n));

  const confirm = () => {
    if (mode === "changes") {
      decide.mutate(
        { decision: "REQUEST_CHANGES", notes: notes.trim() || undefined, revision_days: revisionDays },
        { onSuccess: () => setMode(null) }
      );
    } else if (mode === "schedule" && whenDate) {
      decide.mutate(
        { decision: "APPROVE", notes: notes.trim() || undefined, publish_at: whenDate.toISOString(), confirmed_rules: confirmedRules },
        { onSuccess: () => setMode(null) }
      );
    } else if (mode === "now") {
      decide.mutate(
        { decision: "APPROVE", notes: notes.trim() || undefined, publish_now: true, confirmed_rules: confirmedRules },
        {
          onSuccess: () => {
            setMode(null);
            if (target.platforms[0]) navigate(`/content-calendar/publish/sub-${target.id}/${target.platforms[0]}`);
          },
        }
      );
    }
  };

  const bar = layout === "bar" || layout === "inline";
  const barOutline =
    "h-11 rounded-lg text-sm font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10";

  return (
    <div className={bar ? "" : `@container rounded-xl border border-border/70 bg-muted/30 ${compact ? "p-3" : "p-4"} space-y-3`}>
      {!bar && (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Your review
          </p>
          <p className="text-[11px] text-muted-foreground">
            Version {target.current_version}
            {target.score != null && ` · rulebook check ${target.score}/100`}
            {approvalScore != null && target.score != null && approvalScore !== target.score && ` (${approvalScore}/100 after dismissed flags)`}
            {openComments > 0 && ` · ${openComments} open comment${openComments === 1 ? "" : "s"}`}
            {planned && ` · planned for ${format(planned, "MMM d, h:mm a")}`}
          </p>
          {target.due_kind === "REVIEW" && <DueBadge dueAt={target.due_at} kind="REVIEW" className="mt-1.5" />}
        </div>
      )}
      {openCritical > 0 && (
        <p className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {openCritical} critical flag{openCritical === 1 ? " is" : "s are"} still open. Request changes to fix{" "}
          {openCritical === 1 ? "it" : "them"}, or dismiss {openCritical === 1 ? "it" : "them"} as a false alarm in the flags list, before approving.
        </p>
      )}
      {scoreTooLow && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          The rulebook score is {approvalScore}/100; approval needs at least {minScore}. Request changes to fix the
          flagged wording, or dismiss flags that are false alarms in the flags list (each gives its points back).
        </p>
      )}
      {target.approver_names && target.approver_names.length > 0 && (
        <p className={`text-[11px] ${target.can_approve === false ? "rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-900 dark:text-amber-100" : "text-muted-foreground"}`}>
          {target.can_approve === false
            ? `Final approval is with ${target.approver_names.join(", ")}. You can still comment or request changes.`
            : `Final approval: ${target.approver_names.join(", ")}`}
        </p>
      )}
      {layout === "inline" ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold" onClick={() => start("changes")}>
            <MessageSquareWarning className="w-3.5 h-3.5" /> Request changes
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold" onClick={() => start("schedule")} disabled={!mayApprove}>
            <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => start("now")}
            disabled={!target.platforms.length || !mayApprove}
          >
            <Check className="w-3.5 h-3.5" /> Approve content
          </Button>
        </div>
      ) : bar ? (
        // The main action gets its own row so no label is cut off, however narrow the side panel is.
        <div className="grid grid-cols-2 gap-2">
          <Button className="col-span-2 h-11 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => start("now")} disabled={!target.platforms.length || !mayApprove}>
            Approve & publish
          </Button>
          <Button variant="outline" className={barOutline} onClick={() => start("changes")}>
            Request changes
          </Button>
          <Button variant="outline" className={barOutline} onClick={() => start("schedule")} disabled={!mayApprove}>
            Add to calendar
          </Button>
        </div>
      ) : (
      // Three across when the panel is wide enough; otherwise the main action takes its own row.
      <div className="grid grid-cols-2 @lg:grid-cols-3 gap-2">
        <Button size="sm" className="col-span-2 @lg:col-span-1 text-xs gap-1.5 bg-blue-700 hover:bg-blue-800 text-white" onClick={() => start("schedule")} disabled={!mayApprove}>
          <CalendarPlus className="w-3.5 h-3.5" /> Approve & schedule
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => start("now")} disabled={!target.platforms.length || !mayApprove}>
          <Send className="w-3.5 h-3.5" /> Approve & post now
        </Button>
        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => start("changes")}>
          <MessageSquareWarning className="w-3.5 h-3.5" /> Request changes
        </Button>
      </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {mode === "changes" ? `Send ${target.reference_code} back for changes` : mode === "now" ? `Approve ${target.reference_code} and post now` : `Approve ${target.reference_code} for the calendar`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {mode === "changes"
                ? "The person who uploaded it gets a notification with your note and comments, makes the changes and resubmits it to you."
                : mode === "now"
                ? "It's approved and you go straight to the publish page for its platform."
                : "It's approved and goes on the content calendar for this time. You or the team publish it from there."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {mode === "schedule" && (
              <div className="space-y-1.5">
                <Label htmlFor="review-when" className="text-xs font-semibold">Publish on</Label>
                <Input id="review-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="text-xs" />
                {planned && <p className="text-[11px] text-muted-foreground">Planned by the creator for {format(planned, "EEE MMM d, h:mm a")}.</p>}
                {whenInPast && <p className="text-[11px] text-red-600">Pick a time in the future, or use "Approve & post now".</p>}
              </div>
            )}
            {mode !== "changes" && manualRules.length > 0 && (
              <fieldset className="space-y-1.5 rounded-md border border-border/70 p-2.5">
                <legend className="px-1 text-xs font-semibold text-foreground">Checked by you</legend>
                <p className="text-[11px] text-muted-foreground">
                  The automated check can't test these from the text. Confirm you've checked each one; it's recorded with your approval.
                </p>
                {manualRules.map((r) => (
                  <label key={r.rule_number} className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
                      checked={confirmed.has(r.rule_number)}
                      onChange={() => toggleConfirmed(r.rule_number)}
                    />
                    <span>
                      <span className="font-semibold">{r.rule_number}</span> · {r.title}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {mode === "changes" && openComments > 0 && (
              <p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Your {openComments} open comment{openComments === 1 ? " is" : "s are"} sent along with this.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="review-notes" className="text-xs font-semibold">
                {mode === "changes" ? (openComments ? "Summary (optional)" : "What needs to change") : "Note to the creator (optional)"}
              </Label>
              <Textarea
                id="review-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
                placeholder={mode === "changes" ? "e.g. The product is still in testing; rephrase the availability claim." : "e.g. Great post, scheduled for the morning slot."}
              />
            </div>
            {mode === "changes" && (
              <RevisionTimelinePicker value={revisionDays} onChange={setRevisionDays} publishAt={target.publish_at} />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className={`text-xs gap-1.5 ${mode === "changes" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-blue-700 hover:bg-blue-800 text-white"}`}
              disabled={
                decide.isPending ||
                (mode === "changes" && !notes.trim() && openComments === 0) ||
                (mode === "schedule" && (!whenDate || whenInPast)) ||
                (mode !== "changes" && !allConfirmed)
              }
              onClick={confirm}
            >
              {decide.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "changes" ? "Send back for changes" : mode === "now" ? "Approve & open publish page" : "Approve & schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * For the creator: the reviewer sent it back. Shows their note and the open comments count, with the way to
 * edit and resubmit.
 */
export function ChangesRequestedBanner({
  submissionId,
  job,
  openComments,
  canEdit,
}: {
  submissionId: string;
  job?: ReviewJob | null;
  openComments: number;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-100">
        <MessageSquareWarning className="w-4 h-4" /> Changes requested
        {job?.decided_by_name && <span className="font-normal text-muted-foreground"> by {job.decided_by_name}</span>}
        {job?.decided_at && <span className="font-normal text-muted-foreground"> · {formatDistanceToNow(new Date(job.decided_at), { addSuffix: true })}</span>}
      </p>
      {job?.decision_notes && <p className="text-sm text-foreground whitespace-pre-wrap">"{job.decision_notes}"</p>}
      <p className="text-xs text-muted-foreground">
        {openComments > 0 ? `${openComments} comment${openComments === 1 ? "" : "s"} still open. ` : ""}
        Make the changes, mark comments resolved as you go, then resubmit. It goes back to the reviewer as the next version.
      </p>
      {canEdit && (
        <Button size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/submissions/new?id=${submissionId}`)}>
          <FilePen className="w-3.5 h-3.5" /> Make changes & resubmit
        </Button>
      )}
    </div>
  );
}
