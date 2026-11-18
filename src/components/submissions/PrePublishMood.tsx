import { Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopicTrend from "@/components/submissions/TopicTrend";
import { usePublicMood } from "@/hooks/usePublicMood";
import { toast } from "sonner";

/** Optional final timing check for approved content immediately before publication. */
export default function PrePublishMood({ submissionId, canRun, beforeCheck }: { submissionId: string; canRun: boolean; beforeCheck?: () => Promise<unknown> }) {
  const { mood, run, isLoading, hasRun, error } = usePublicMood(submissionId, canRun, false, true);
  const runCheck = async () => {
    try {
      await beforeCheck?.();
      await run();
    } catch (err) {
      toast.error(`Couldn't check public mood: ${(err as Error).message}`);
    }
  };
  return (
    <section aria-label="Pre-publish public mood" className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-500/30 dark:bg-sky-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold"><Globe2 className="size-4" />Public mood before posting</h3>
          <p className="mt-1 text-xs text-muted-foreground">Check current conversation and timing before you publish. This is optional.</p></div>
        {canRun && <Button type="button" onClick={() => void runCheck()} disabled={isLoading} className="h-11 gap-2 rounded-xl px-5 font-semibold">
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}{hasRun ? "Check public mood again" : "Check public mood"}
        </Button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Public mood could not be checked. Please try again.</p>}
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Checking current public mood?</p>}
      {hasRun && mood && !isLoading && <TopicTrend submissionId={submissionId} mood={mood} isLoading={false} hasRun canEdit={false} />}
    </section>
  );
}
