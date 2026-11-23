import type { ReactNode } from "react";
import { AI_UNAVAILABLE_MESSAGE } from "@/components/submissions/submissionUi";

/** A note below the calculated score when some review stages did not finish. */
export default function UnavailableCompliance({ header, extra }: { header?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="space-y-2">
      {header}
      <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        {AI_UNAVAILABLE_MESSAGE}
      </p>
      {extra}
    </div>
  );
}
