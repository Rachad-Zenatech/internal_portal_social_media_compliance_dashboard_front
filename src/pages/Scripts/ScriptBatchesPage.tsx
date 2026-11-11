import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FileStack, Plus } from "lucide-react";

import BulkScriptDialog from "@/components/script/BulkScriptDialog";
import { Button } from "@/components/ui/button";
import { useScriptBatches } from "@/hooks/useScriptBatches";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import type { BatchStatus, BatchSummary } from "@/types/scriptBatch";

const STATUS: Record<BatchStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Being checked", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  IN_REVIEW: { label: "In review", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  DONE: { label: "All approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

function Row({ batch, reviewing }: { batch: BatchSummary; reviewing: boolean }) {
  const s = STATUS[batch.status];
  return (
    <li>
      <Link
        to={`/script-batches/${batch.id}`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{batch.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {batch.total} script{batch.total === 1 ? "" : "s"}
            {reviewing && batch.created_by_name ? ` · from ${batch.created_by_name}` : ""}
            {` · ${formatDistanceToNow(new Date(batch.sent_at ?? batch.created_at), { addSuffix: true })}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {batch.in_review > 0 && <span className="text-blue-700 dark:text-blue-400">{batch.in_review} to review</span>}
          {batch.changes_requested > 0 && <span className="text-amber-700 dark:text-amber-400">{batch.changes_requested} sent back</span>}
          {batch.approved > 0 && <span className="text-emerald-700 dark:text-emerald-400">{batch.approved} approved</span>}
          <span className={cn("rounded-full px-2 py-0.5 font-medium", s.tone)}>{s.label}</span>
        </div>
      </Link>
    </li>
  );
}

/** Script batches: the ones a creator uploaded, and (for reviewers) the ones sent for review. */
export default function ScriptBatchesPage() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission("CONTENT_REVIEW_APPROVE");
  const [tab, setTab] = useState<"mine" | "review">(canReview ? "review" : "mine");
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data, isLoading, error } = useScriptBatches(tab);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Script batches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Several scripts uploaded together and reviewed together. Each approved script becomes a post to film.
          </p>
        </div>
        {tab === "mine" && (
          <Button type="button" onClick={() => setUploadOpen(true)} className="gap-2 bg-blue-700 text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> Upload scripts
          </Button>
        )}
      </div>

      {canReview && (
        <div role="tablist" aria-label="Which batches" className="flex gap-2">
          {([["review", "To review"], ["mine", "My uploads"]] as const).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium",
                tab === value ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Couldn't load the batches."}</p>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((b) => (
            <Row key={b.id} batch={b} reviewing={tab === "review"} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center">
          <FileStack className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {tab === "review" ? "No script batches are waiting for you" : "You haven't uploaded any script batches"}
          </p>
          {tab === "mine" && (
            <p className="max-w-sm text-xs text-muted-foreground">
              Upload one document with all your scripts. They are reviewed together, then each approved script becomes a post.
            </p>
          )}
        </div>
      )}

      <BulkScriptDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
