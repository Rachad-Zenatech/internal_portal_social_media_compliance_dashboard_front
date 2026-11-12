import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, FileStack } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ScriptBatchRef } from "@/types/script";

/**
 * The strip across the top of a script that came in a batch: which batch and which script this is, and a way to step to
 * the previous or next one (or straight to the next that still needs a reviewer). Each script is reviewed on its own page,
 * with its flags, comments and edits; this keeps the batch together.
 */
export default function ScriptBatchBar({
  batch,
  reviewer,
  onOpen,
}: {
  batch: ScriptBatchRef;
  /** Reviewers open scripts in the Content screener; the creator on the post's script page. */
  reviewer: boolean;
  /** Open another script of the batch in place (the screener keeps its list, so it picks the script itself). */
  onOpen?: (submissionId: string) => void;
}) {
  const href = (id: string) => (reviewer ? `/script-review/scripts/${id}` : `/submissions/${id}/script`);

  const go = (id: string | null | undefined, label: string, icon: React.ReactNode, primary = false) => {
    const content = (
      <>
        {label} {icon}
      </>
    );
    const className = primary ? "h-8 gap-1.5 bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800" : "h-8 gap-1.5 text-xs";
    if (!id) {
      return (
        <Button type="button" size="sm" variant="outline" disabled className={className}>
          {content}
        </Button>
      );
    }
    return onOpen ? (
      <Button type="button" size="sm" variant={primary ? "default" : "outline"} className={className} onClick={() => onOpen(id)}>
        {content}
      </Button>
    ) : (
      <Button asChild size="sm" variant={primary ? "default" : "outline"} className={className}>
        <Link to={href(id)}>{content}</Link>
      </Button>
    );
  };

  return (
    <div
      role="navigation"
      aria-label="Scripts in this batch"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-blue-50/60 px-4 py-2 dark:bg-blue-500/10"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={`/script-review/${batch.batch_id}`}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-blue-800 hover:underline dark:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <FileStack className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{batch.title}</span>
        </Link>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Script {batch.position} of {batch.total}
          {batch.waiting > 0 ? ` · ${batch.waiting} waiting for a reviewer` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {go(batch.previous_id, "Previous", <ChevronLeft className="order-first h-3.5 w-3.5" />)}
        {go(batch.next_id, "Next", <ChevronRight className="h-3.5 w-3.5" />)}
        {reviewer &&
          batch.next_waiting_id &&
          go(batch.next_waiting_id, "Next to review", <ArrowRight className="h-3.5 w-3.5" />, true)}
      </div>
    </div>
  );
}
