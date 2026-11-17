import { ArrowRight, FileCheck2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ScriptReviewNotice() {
  return (
    <aside aria-label="Script approvals" className="flex items-start gap-2.5 rounded-xl border border-blue-200/70 bg-blue-50/70 p-3 dark:border-blue-500/25 dark:bg-blue-500/10">
      <FileCheck2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-700 dark:text-blue-300" />
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-foreground">Looking for scripts?</p>
        <p className="text-xs leading-relaxed text-muted-foreground">Scripts have their own queue. Open Script review to review and approve them.</p>
        <Link to="/script-review" className="inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:text-blue-300">
          Open Script review <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </aside>
  );
}
