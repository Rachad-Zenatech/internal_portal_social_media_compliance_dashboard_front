import type { ReactNode } from "react";
import type { StoredCheck } from "@/types/submission";
import { incompleteCheckDetails } from "@/lib/incompleteCheck";

/** A note below the calculated score when some review stages did not finish. */
export default function UnavailableCompliance({ check, header, extra }: { check?: StoredCheck; header?: ReactNode; extra?: ReactNode }) {
  const details = incompleteCheckDetails(check);
  const reasons = details.reasons.map(reason => <li key={reason}>{reason}</li>);
  return (
    <div className="space-y-2">
      {header}
      <div role="status" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-semibold">{details.title}</p>
        {reasons.length ? <ul className="list-disc space-y-1 pl-5">{reasons}</ul> : <p>This saved result does not identify which step failed. Check again to get a detailed result.</p>}
        <p>Completed findings are kept. The score is provisional, even if it is 100. Use Check again to complete the review.</p>
      </div>
      {extra}
    </div>
  );
}

export function IncompleteFindingsNotice() {
  return <p className="rounded-xl border border-dashed border-amber-300 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">No findings were returned by the completed checks. Some checks did not finish, so this does not mean the post is clear.</p>;
}
