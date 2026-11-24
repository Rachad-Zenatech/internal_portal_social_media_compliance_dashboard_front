interface Props {
  originalScore: number;
  recalculatedScore?: number;
  minimumScore: number;
}

/** Pending requests can unlock review routing; a reviewer still decides whether to dismiss them. */
export default function PendingDismissalScore({ originalScore, recalculatedScore, minimumScore }: Props) {
  if (recalculatedScore == null || recalculatedScore <= originalScore) return null;
  const eligible = recalculatedScore >= minimumScore;
  const tone = eligible ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100"
    : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100";
  const guidance = eligible
    ? "You can send this post for review with your dismissal requests. A reviewer must decide them before final approval."
    : `The recalculated score still needs ${minimumScore - recalculatedScore} more points to reach ${minimumScore} before you can send for review.`;
  return (
    <section aria-label="Score with pending dismissal requests" aria-live="polite" className={`space-y-2 rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Recalculated score for sending to review</h3>
        <strong className="text-xl tabular-nums">{recalculatedScore}/100</strong>
      </div>
      <p className="text-xs">Original compliance score: <strong>{originalScore}/100</strong>. The recalculated score excludes the deductions covered by your pending dismissal requests.</p>
      <p className="text-xs leading-relaxed">{guidance}</p>
    </section>
  );
}
