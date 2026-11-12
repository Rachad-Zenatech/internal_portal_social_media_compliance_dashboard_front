import { ArrowRight, Check, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dueInfo } from "@/components/submissions/submissionUi";
import type { PostStepKey } from "@/types/submission";

export type RecheckState = { compliance: boolean; sentiment: boolean; mood: boolean };

const CHECKS: { key: keyof RecheckState; step: PostStepKey; label: string }[] = [
  { key: "compliance", step: "compliance", label: "Compliance check" },
  { key: "sentiment", step: "sentiment", label: "Sentiment analysis" },
  { key: "mood", step: "mood", label: "Public mood" },
];

function Mark({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
        done ? "bg-blue-600 text-white" : "border-2 border-blue-600 bg-card text-blue-700 dark:text-blue-300"
      }`}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
    </span>
  );
}

/**
 * The way back after a reviewer asks for changes, on every step of the post: what the reviewer said, then 1. make the
 * changes, 2. run the checks again on the changed post, 3. resubmit. Resubmitting waits for step 2.
 */
export default function RevisionGuide({
  reviewer,
  note,
  dueAt,
  openComments,
  changesMade,
  rechecked,
  submitting,
  onOpenStep,
  onResubmit,
}: {
  reviewer?: string | null;
  /** The reviewer's note with the decision. */
  note?: string | null;
  dueAt?: string | null;
  openComments: number;
  changesMade: boolean;
  /** Which checks have run again since the reviewer asked for changes. */
  rechecked: RecheckState;
  submitting: boolean;
  onOpenStep: (step: PostStepKey) => void;
  onResubmit: () => void;
}) {
  const due = dueInfo(dueAt, "REVISION");
  const checksDone = rechecked.compliance && rechecked.sentiment;
  const nextCheck = CHECKS.find((c) => !rechecked[c.key]);

  return (
    <section aria-label="Changes requested" className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{reviewer ?? "Your reviewer"} asked for changes</p>
          {note && <p className="mt-1 text-sm text-muted-foreground">“{note}”</p>}
        </div>
        {due && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              due.overdue ? "bg-red-600 text-white" : "bg-muted text-foreground"
            }`}
          >
            {due.overdue ? `Overdue · was due ${due.exact}` : `Resubmit by ${due.exact}`}
          </span>
        )}
      </div>

      <ol className="grid gap-px bg-border/60 md:grid-cols-3">
        {/* 1. Make the changes */}
        <li className="flex flex-col gap-2 bg-card p-4">
          <div className="flex items-center gap-2.5">
            <Mark n={1} done={changesMade} />
            <p className="text-sm font-semibold text-foreground">Make the changes</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {openComments > 0
              ? `${openComments} open comment${openComments === 1 ? "" : "s"} from the reviewer. Fix each one, then reply or resolve it.`
              : "Every comment is resolved. Make sure the post reflects them."}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-auto h-8 w-fit gap-1.5 text-xs" onClick={() => onOpenStep("details")}>
            See the comments and edit
          </Button>
        </li>

        {/* 2. Run the checks again */}
        <li className="flex flex-col gap-2 bg-card p-4">
          <div className="flex items-center gap-2.5">
            <Mark n={2} done={checksDone} />
            <p className="text-sm font-semibold text-foreground">Run the checks again</p>
          </div>
          <ul className="flex flex-col gap-1">
            {CHECKS.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => onOpenStep(c.step)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted/60"
                >
                  <span className="text-foreground">{c.label}</span>
                  {rechecked[c.key] ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} /> Done
                    </span>
                  ) : (
                    <span className="font-semibold text-muted-foreground">Run again</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {nextCheck && (
            <Button
              type="button"
              size="sm"
              className="mt-auto h-8 w-fit gap-1.5 bg-blue-700 text-xs text-white hover:bg-blue-800"
              onClick={() => onOpenStep(nextCheck.step)}
            >
              Run the {nextCheck.label.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>

        {/* 3. Resubmit */}
        <li className="flex flex-col gap-2 bg-card p-4">
          <div className="flex items-center gap-2.5">
            <Mark n={3} done={false} />
            <p className="text-sm font-semibold text-foreground">Resubmit for review</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {checksDone
              ? "Your changes are checked. Send the new version back to the reviewer."
              : "Opens once the compliance check and sentiment analysis have run on your changes."}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!checksDone || submitting}
            onClick={onResubmit}
            className="mt-auto h-8 w-fit gap-1.5 bg-blue-700 text-xs text-white hover:bg-blue-800"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Resubmit for review
          </Button>
        </li>
      </ol>
    </section>
  );
}
