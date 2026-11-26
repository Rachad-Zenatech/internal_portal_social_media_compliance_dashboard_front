import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CalendarPlus, Check, FilePen, Loader2, MessageSquareWarning, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useReviewComments, useReviewDecision } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { DueKind, ReviewJob } from "@/types/submission";
import { DueBadge } from "@/components/submissions/submissionUi";
import ReviewDecisionBar from "@/components/submissions/ReviewDecisionBar";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import { DelegateReviewButton } from "@/components/submissions/DelegateReview";
import RevisionTimelinePicker, { DEFAULT_TIMELINE, timelineFields, timelineValid, type Timeline } from "@/components/submissions/RevisionTimelinePicker";

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
  /** Critical flags nobody has dismissed, shown as guidance during review. */
  open_critical_flags?: number;
  /** The score counting only flags nobody has dismissed, for reviewer reference. */
  approval_score?: number | null;
  min_approval_score?: number;
  score?: number | null;
  /** Rules the automated check can't test from text; listed as reminders for the reviewer. */
  manual_rules?: { rule_number: string; title: string }[];
  /** The AI review could not finish; checking is optional during human review. */
  ai_unavailable?: boolean;
  /** The post is still being read, so there's no score yet. */
  analysis_pending?: boolean;
  /** The viewer may hand it to another reviewer (they stay on it and can still decide). */
  can_delegate?: boolean;
  brand_code?: string | null;
  brand_codes?: string[];
  /** Who it was sent to, so the delegate picker leaves them out. */
  reviewer_ids?: string[];
  created_by?: string | null;
}

type Mode = "schedule" | "changes" | null;

function ReviewDecisionHeader({ mode, reference }: { mode: Mode; reference: string }) {
  const title = mode === "changes"
    ? `Send ${reference} back for changes` : `Approve ${reference} for creator to publish`;
  const description = mode === "changes"
    ? "Request another review round. The creator receives the feedback after the suggestion deadline."
    : "Approve the content and send all suggestions to the creator after the suggestion deadline. They can edit text and media, rerun compliance and sentiment, then publish without another review round.";
  return (
    <DialogHeader>
      <DialogTitle className="text-base">{title}</DialogTitle>
      <DialogDescription className="text-xs">{description}</DialogDescription>
    </DialogHeader>
  );
}

/**
 * The reviewer's decision for the version in review: approve it for the creator to publish, or
 * send it back with what to change. Only shown to reviewers who may decide on this item.
 */
export default function ReviewDecisionPanel({
  target,
  compact = false,
  layout = "panel",
}: {
  target: ReviewTarget;
  compact?: boolean;
  /** "bar": primary decisions with quieter secondary actions. "inline": only the buttons, in one wrapping row
   * (the Content Portal's approval footer). Both use the same confirm dialog. */
  layout?: "panel" | "bar" | "inline";
}) {
  const openCritical = target.open_critical_flags ?? 0;
  const minScore = Math.max(90, target.min_approval_score ?? 0);
  const approvalScore = target.approval_score ?? null;
  // Shown once critical flags are dealt with, since those come first (and cap the score anyway).
  const scoreTooLow = openCritical === 0 && approvalScore != null && approvalScore < minScore;
  // Checks inform the reviewer; final-content validation remains with creator publishing.
  const checkNotReady = Boolean(target.ai_unavailable || target.analysis_pending);
  const mayApprove = target.can_approve !== false;
  const decide = useReviewDecision(target.id, target.reference_code);
  const { creatorView } = useAuth();
  const { comments } = useReviewComments(target.id);
  const openComments = comments.filter((c) => !c.resolved_at && c.version_number === target.current_version).length;
  const [mode, setMode] = useState<Mode>(null);
  const [notes, setNotes] = useState("");
  const [timeline, setTimeline] = useState<Timeline>(DEFAULT_TIMELINE);

  // Not a reviewer here, or a super admin viewing the app as a creator.
  if (!target.can_review || creatorView) return null;

  const manualRules = target.manual_rules ?? [];
  const planned = target.publish_at ? new Date(target.publish_at) : null;
  const start = (m: Mode) => {
    setNotes("");
    setTimeline(DEFAULT_TIMELINE);
    setMode(m);
  };
  const confirm = () => {
    if (mode === "changes") {
      const due = timelineFields(timeline);
      decide.mutate(
        {
          decision: "REQUEST_CHANGES",
          notes: notes.trim() || undefined,
          revision_days: due.days,
          revision_due_at: due.at,
          publish_after_changes: false,
        },
        { onSuccess: () => setMode(null) }
      );
    } else if (mode === "schedule") {
      decide.mutate(
        { decision: "APPROVE", notes: notes.trim() || undefined, publish_after_changes: true },
        { onSuccess: () => setMode(null) }
      );
    }
  };

  const bar = layout === "bar" || layout === "inline";

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
      <ComplianceReviewNotes
        checkNotReady={checkNotReady}
        analysisPending={Boolean(target.analysis_pending)}
        openCritical={openCritical}
        scoreTooLow={scoreTooLow}
        approvalScore={approvalScore}
        minScore={minScore}
      />
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

          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => start("schedule")}
            disabled={!mayApprove}
          >
            <Check className="w-3.5 h-3.5" /> Approve content
          </Button>
        </div>
      ) : bar ? (
        <ReviewDecisionBar target={target} mayApprove={mayApprove} onStart={start} />
      ) : (
      // The reviewer can approve the content or request changes.
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" className="text-xs gap-1.5 bg-blue-700 hover:bg-blue-800 text-white" onClick={() => start("schedule")} disabled={!mayApprove}>
          <CalendarPlus className="w-3.5 h-3.5" /> Approve content
        </Button>

        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => start("changes")}>
          <MessageSquareWarning className="w-3.5 h-3.5" /> Request changes
        </Button>

      </div>
      )}
      {target.can_delegate && layout !== "bar" && (
        <div className="flex justify-end">
          <DelegateReviewButton target={target} className={layout === "inline" ? "h-9 text-xs font-semibold" : "text-xs"} />
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <ReviewDecisionHeader mode={mode} reference={target.reference_code} />

          <div className="space-y-3">
            {mode !== "changes" && <ManualRulesList rules={manualRules} />}
            {(mode === "changes") && openComments > 0 && (
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
                placeholder={mode === "changes" ? "e.g. The product is still in testing; rephrase the availability claim." : "e.g. Approved. Ready for you to publish."}
              />
            </div>
            {(mode === "changes") && (
              <RevisionTimelinePicker value={timeline} onChange={setTimeline} publishAt={target.publish_at} />
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
                ((mode === "changes") && !notes.trim() && openComments === 0) ||
                ((mode === "changes") && !timelineValid(timeline))
              }
              onClick={confirm}
            >
              {decide.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "changes" ? "Record requested changes" : "Approve content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const WARN_AMBER = "rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100";

/** Compliance findings inform the human decision without requiring the reviewer to run AI. */
function ComplianceReviewNotes({
  checkNotReady,
  analysisPending,
  openCritical,
  scoreTooLow,
  approvalScore,
  minScore,
}: {
  checkNotReady: boolean;
  analysisPending: boolean;
  openCritical: number;
  scoreTooLow: boolean;
  approvalScore: number | null;
  minScore: number;
}) {
  const one = openCritical === 1;
  return (
    <>
      {checkNotReady && (
        <p className={WARN_AMBER}>
          {analysisPending
            ? "Compliance is still running. You can record your review decision now; the creator must check the final content before publishing."
            : "No completed AI result is available. Rechecking is optional for reviewers; the creator must check the final content before publishing."}
        </p>
      )}
      {openCritical > 0 && (
        <p className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {openCritical} critical flag{one ? " is" : "s are"} still open. Review {one ? "it" : "them"} and leave guidance for the creator, or dismiss{" "}
          {one ? "it" : "them"} as a false alarm in the flags list.
        </p>
      )}
      {scoreTooLow && (
        <p className={WARN_AMBER}>
          The saved rulebook score is {approvalScore}/100 (publishing target: {minScore}). Review the
          flagged wording and leave guidance for the creator, or dismiss flags that are false alarms. This does not block your review decision.
        </p>
      )}
    </>
  );
}

/** Review reminders are informational and do not require individual confirmation. */
function ManualRulesList({ rules }: { rules: { rule_number: string; title: string }[] }) {
  if (rules.length === 0) return null;
  const items = rules.map(rule => (
    <li key={rule.rule_number} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
      <span className="shrink-0"><RuleNumberBadge v={rule} /></span><span>{rule.title}</span>
    </li>
  ));
  return (
    <section aria-label="Review reminders" className="space-y-3 rounded-xl border border-border/70 p-3">
      <div><h3 className="text-xs font-semibold">Keep in mind</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">These rules need human judgment beyond the automated check. They're listed here for your reference.</p></div>
      <ul className="space-y-1.5">{items}</ul>
    </section>
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
