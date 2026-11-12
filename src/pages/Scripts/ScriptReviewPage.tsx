import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { FileStack, FileText, Plus } from "lucide-react";

import BulkScriptDialog from "@/components/script/BulkScriptDialog";
import ListPager from "@/components/common/ListPager";
import { usePaged } from "@/hooks/usePaged";
import { Button } from "@/components/ui/button";
import { useScriptBatches } from "@/hooks/useScriptBatches";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { scriptService } from "@/services/scriptService";
import type { ScriptQueueItem } from "@/types/script";
import type { BatchStatus, BatchSummary } from "@/types/scriptBatch";

const STATUS: Record<BatchStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Not sent yet", tone: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Being checked", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  IN_REVIEW: { label: "In review", tone: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  DONE: { label: "All approved", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

type ReviewTab = "review" | "sent_back" | "done";
const TABS: { value: ReviewTab; label: string; status: BatchStatus }[] = [
  { value: "review", label: "To review", status: "IN_REVIEW" },
  { value: "sent_back", label: "Sent back", status: "CHANGES_REQUESTED" },
  { value: "done", label: "Approved", status: "DONE" },
];

type CreatorFilter = "all" | BatchStatus;
const CREATOR_FILTERS: { value: CreatorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "CHANGES_REQUESTED", label: "Needs changes" },
  { value: "DONE", label: "Approved" },
  { value: "DRAFT", label: "Not sent" },
];

/** The grid every list uses: one column on a phone, more as the screen allows, many on a large monitor. */
const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[112.5rem]:grid-cols-4";

/** How far a batch has got: a bar split by where its scripts are. */
function Progress({ b }: { b: BatchSummary }) {
  const total = Math.max(b.total, 1);
  const rest = Math.max(b.total - b.approved - b.in_review - b.changes_requested, 0);
  const parts = [
    { n: b.approved, tone: "bg-emerald-500", label: "approved" },
    { n: b.in_review, tone: "bg-blue-500", label: "in review" },
    { n: b.changes_requested, tone: "bg-amber-500", label: "need changes" },
    { n: rest, tone: "bg-muted-foreground/30", label: "not sent" },
  ];
  return (
    <div
      role="img"
      aria-label={parts.filter((p) => p.n).map((p) => `${p.n} ${p.label}`).join(", ")}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      {parts.map((p) => (p.n ? <span key={p.label} className={p.tone} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
    </div>
  );
}

function BatchCard({ batch, showCreator }: { batch: BatchSummary; showCreator: boolean }) {
  const s = STATUS[batch.status];
  return (
    <li className="min-w-0">
      <Link
        to={`/script-review/${batch.id}`}
        className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-muted/30"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
              <FileStack className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{batch.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {batch.total} script{batch.total === 1 ? "" : "s"}
                {showCreator && batch.created_by_name ? ` · ${batch.created_by_name}` : ""}
              </p>
            </div>
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone)}>{s.label}</span>
        </div>
        <Progress b={batch} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
          <span className="flex flex-wrap gap-x-3 gap-y-0.5">
            {batch.in_review > 0 && <span className="text-blue-700 dark:text-blue-400">{batch.in_review} to review</span>}
            {batch.changes_requested > 0 && <span className="text-amber-700 dark:text-amber-400">{batch.changes_requested} sent back</span>}
            {batch.approved > 0 && <span className="text-emerald-700 dark:text-emerald-400">{batch.approved} approved</span>}
          </span>
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(batch.sent_at ?? batch.created_at), { addSuffix: true })}
          </span>
        </div>
      </Link>
    </li>
  );
}

/** A script that was uploaded on its own (not in a batch). It is reviewed on its own page in this section. */
function ScriptCard({ s }: { s: ScriptQueueItem }) {
  const score = s.ai_unavailable ? null : s.score;
  return (
    <li className="min-w-0">
      <Link
        to={`/script-review/scripts/${s.id}`}
        className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-blue-300 hover:bg-muted/30"
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{s.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {s.reference_code}
              {s.creator_name ? ` · ${s.creator_name}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{s.ai_unavailable ? "No score yet" : score != null ? `${score}/100` : "Not scored"}</span>
          <span>{formatDistanceToNow(new Date(s.sent_at), { addSuffix: true })}</span>
        </div>
      </Link>
    </li>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-14 text-center">
      <FileStack className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Script review: every script, whether it was uploaded alone or in a batch of several. Creators upload scripts here and
 * follow where each is; reviewers see what is waiting for them, what they sent back and what they approved.
 */
export default function ScriptReviewPage() {
  const { hasPermission } = useAuth();
  const reviewer = hasPermission("CONTENT_REVIEW_VIEW");
  const [tab, setTab] = useState<ReviewTab>("review");
  const [filter, setFilter] = useState<CreatorFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const batches = useScriptBatches(reviewer ? "review" : "mine");
  // Scripts uploaded on their own (not in a batch) are listed with the batches, for reviewers.
  const singles = useQuery({
    queryKey: ["script-queue", tab],
    queryFn: () => scriptService.queue(tab),
    enabled: reviewer,
    staleTime: 15_000,
  });

  const shownBatches = useMemo(() => {
    const all = batches.data ?? [];
    if (reviewer) return all.filter((b) => b.status === TABS.find((t) => t.value === tab)!.status);
    return filter === "all" ? all : all.filter((b) => b.status === filter);
  }, [batches.data, reviewer, tab, filter]);
  const shownSingles = useMemo(() => (singles.data ?? []).filter((s) => !s.batch_id), [singles.data]);
  const counts = useMemo(() => {
    const all = batches.data ?? [];
    return Object.fromEntries(TABS.map((t) => [t.value, all.filter((b) => b.status === t.status).length])) as Record<ReviewTab, number>;
  }, [batches.data]);

  // Batches and single scripts together, 24 to a page; a new tab or filter starts from the first page.
  type ListCard = { kind: "batch"; b: BatchSummary } | { kind: "single"; s: ScriptQueueItem };
  const cards = useMemo<ListCard[]>(
    () => [
      ...shownBatches.map((b) => ({ kind: "batch" as const, b })),
      ...(reviewer ? shownSingles.map((s) => ({ kind: "single" as const, s })) : []),
    ],
    [shownBatches, shownSingles, reviewer]
  );
  const paged = usePaged(cards, 24, [tab, filter]);

  const loading = batches.isLoading || (reviewer && singles.isLoading);
  const error = batches.error ?? (reviewer ? singles.error : null);
  const nothing = shownBatches.length === 0 && (!reviewer || shownSingles.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-8 min-[112.5rem]:max-w-[2200px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Script review</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {reviewer
              ? "Scripts creators sent for review, one or many at a time. Open a batch to review its scripts, one by one or together."
              : "Upload one script or several in a document. A reviewer reviews them, and each approved script becomes a post for you to film."}
          </p>
        </div>
        {!reviewer && (
          <Button type="button" onClick={() => setUploadOpen(true)} className="h-10 gap-2 bg-blue-700 px-4 text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> Upload scripts
          </Button>
        )}
      </div>

      <div role="tablist" aria-label={reviewer ? "Which scripts" : "Filter"} className="flex flex-wrap gap-2">
        {reviewer
          ? TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  tab === t.value ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className={cn("rounded-full px-1.5 text-[11px]", tab === t.value ? "bg-white/20" : "bg-muted")}>{counts[t.value]}</span>
              </button>
            ))
          : CREATOR_FILTERS.map((f) => (
              <button
                key={f.value}
                role="tab"
                aria-selected={filter === f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filter === f.value ? "border-blue-700 bg-blue-700 text-white" : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Couldn't load the scripts."}</p>
      ) : nothing ? (
        <Empty
          title={
            reviewer
              ? { review: "No scripts are waiting for you", sent_back: "Nothing is waiting on a creator", done: "No approved scripts yet" }[tab]
              : "No scripts here yet"
          }
          hint={reviewer ? undefined : "Use Upload scripts to start. One document can hold as many scripts as you like."}
        />
      ) : (
        <>
          <ul className={GRID}>
            {paged.pageItems.map((c) =>
              c.kind === "batch" ? <BatchCard key={c.b.id} batch={c.b} showCreator={reviewer} /> : <ScriptCard key={c.s.id} s={c.s} />
            )}
          </ul>
          <ListPager
            page={paged.page}
            pageCount={paged.pageCount}
            pageSize={paged.pageSize}
            total={paged.total}
            noun="items"
            onPage={(p) => {
              paged.setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </>
      )}

      <BulkScriptDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
