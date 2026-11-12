import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { contextService } from "@/services/contextService";

const NEWSROOM_URL = "https://www.zenatech.com/newsroom/";

/**
 * Where the facts come from: the ZenaTech newsroom, read once a day. Shows how the last sync went and, for people
 * who manage the context, syncs it now.
 */
export default function NewsroomSyncBar({ canSync }: { canSync: boolean }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["messaging-context", "newsroom-sync"],
    queryFn: contextService.newsroomSync,
    // While a sync runs, follow it so new facts show up as they're added.
    refetchInterval: (q) => (q.state.data?.status === "RUNNING" ? 4000 : false),
  });
  const run = status.data;
  const running = run?.status === "RUNNING";

  // Pull in the facts it adds while it runs, and once more when it finishes.
  const lastSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!run) return;
    const key = `${run.id}:${run.status}:${run.added}:${run.updated}`;
    if (lastSeen.current && lastSeen.current !== key) {
      queryClient.invalidateQueries({ queryKey: ["messaging-context"], exact: true });
      if (run.status === "DONE" && lastSeen.current.startsWith(`${run.id}:RUNNING`)) {
        toast.success(
          run.added || run.updated
            ? `Newsroom synced: ${run.added} new, ${run.updated} updated`
            : "Newsroom synced: no new or changed articles"
        );
      }
      if (run.status === "FAILED" && lastSeen.current.startsWith(`${run.id}:RUNNING`)) {
        toast.error(`The newsroom sync failed: ${run.error ?? "unknown error"}`);
      }
    }
    lastSeen.current = key;
  }, [run, queryClient]);

  const start = useMutation({
    mutationFn: contextService.startNewsroomSync,
    onSuccess: (data) => queryClient.setQueryData(["messaging-context", "newsroom-sync"], data),
    onError: (err) => toast.error(`Couldn't start the sync: ${(err as Error).message}`),
  });

  const done = run ? run.added + run.updated + run.unchanged + run.skipped + run.failed : 0;
  const summary = !run
    ? "Not synced yet."
    : running
    ? `Reading articles: ${done} of ${run.found || "…"} · ${run.added} new, ${run.updated} updated`
    : run.status === "FAILED"
    ? `Last sync failed ${formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}: ${run.error ?? "unknown error"}`
    : `Last synced ${formatDistanceToNow(new Date(run.finished_at ?? run.started_at), { addSuffix: true })} · ${run.found} articles · ${run.added} new, ${run.updated} updated${run.failed ? `, ${run.failed} couldn't be read` : ""}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-sky-50/60 px-4 py-2.5 dark:bg-sky-500/5">
      <div className="min-w-0 text-xs">
        <p className="font-semibold text-foreground">
          Synced from the{" "}
          <a href={NEWSROOM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline dark:text-sky-300">
            ZenaTech newsroom <ExternalLink className="h-3 w-3" />
          </a>{" "}
          every day
        </p>
        <p className={run?.status === "FAILED" ? "text-red-600" : "text-muted-foreground"}>{summary}</p>
      </div>
      {canSync && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-card text-xs" onClick={() => start.mutate()} disabled={running || start.isPending}>
          {running || start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {running ? "Syncing…" : "Sync now"}
        </Button>
      )}
    </div>
  );
}
