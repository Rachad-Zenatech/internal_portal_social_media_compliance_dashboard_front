import type { ScriptQueueSummary } from "@/types/scriptQueue";
import type { BatchStatus, BatchSummary } from "@/types/scriptBatch";

export type ReviewTab = "review" | "sent_back" | "done";
export const SCRIPT_REVIEW_TABS: { value: ReviewTab; label: string; status: BatchStatus }[] = [
  { value: "review", label: "To review", status: "IN_REVIEW" },
  { value: "sent_back", label: "Sent back", status: "CHANGES_REQUESTED" },
  { value: "done", label: "Approved", status: "DONE" },
];

/** A script stays visible on its own when its batch belongs to another tab. */
export function visibleScripts<T extends { batch_id?: string | null }>(scripts: T[], batches: BatchSummary[]): T[] {
  const represented = new Set(batches.map((batch) => batch.id));
  return scripts.filter((script) => !script.batch_id || !represented.has(script.batch_id));
}

export function scriptReviewCounts(batches: BatchSummary[], scripts: ScriptQueueSummary[]): Record<ReviewTab, number> {
  const tabOf = (status: string) => status === "APPROVED" ? "done" : status === "IN_REVIEW" ? "review" : "sent_back";
  return Object.fromEntries(SCRIPT_REVIEW_TABS.map((tab) => {
    const shown = batches.filter((batch) => batch.status === tab.status);
    const single = visibleScripts(scripts.filter((script) => tabOf(script.script_status) === tab.value), shown);
    return [tab.value, shown.length + single.length];
  })) as Record<ReviewTab, number>;
}
