import type { ReactNode } from "react";
import { AI_UNAVAILABLE_MESSAGE } from "@/components/submissions/submissionUi";

/** An unfinished AI review has no findings or score to present. */
export default function UnavailableCompliance({ header, extra }: { header?: ReactNode; extra?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-6">
      {header ?? <h2 className="text-lg font-bold">Compliance check unavailable</h2>}
      <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        {AI_UNAVAILABLE_MESSAGE}
      </p>
      {extra}
    </section>
  );
}
