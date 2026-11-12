import { useState } from "react";
import { ChevronDown, ChevronUp, Globe2, HeartPulse, Loader2 } from "lucide-react";

import CheckingNotice from "@/components/common/CheckingNotice";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import TopicTrend from "@/components/submissions/TopicTrend";
import { Button } from "@/components/ui/button";
import { usePublicMood } from "@/hooks/usePublicMood";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";

/** One checks section that opens and closes: a title, whether it has been run, and its content when open. */
function Section({
  icon,
  title,
  note,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /** Where it stands ("Not run yet", "Done"). */
  note: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        {icon}
        <span className="font-semibold text-foreground">{title}</span>
        <span className={cn("truncate", note === "Not run yet" ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>{note}</span>
        {open ? <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0" />}
      </button>
      {open && <div className="border-t border-border/70 p-3">{children}</div>}
    </section>
  );
}

/**
 * Before a script is sent for review, the creator can read how it comes across, as they can for a post: its sentiment and
 * reputational risk, and how its topics are doing online (public mood). Both read the script that was uploaded.
 */
export default function ScriptInsights({ submissionId, canRun }: { submissionId: string; canRun: boolean }) {
  const [sentimentOpen, setSentimentOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);

  const { analysis } = useSentiment(submissionId);
  const { mood, isLoading: moodLoading, run: runMood, dismissTopic, hasRun: moodHasRun } = usePublicMood(submissionId, moodOpen);

  const sentimentNote = !analysis
    ? "Not run yet"
    : analysis.status === "COMPLETED"
      ? "Done"
      : analysis.status === "FAILED"
        ? "Couldn't run"
        : "Running";
  const moodNote = moodHasRun && mood ? "Done" : "Not run yet";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check how it reads before you send</p>
      <Section
        icon={<HeartPulse className="h-3.5 w-3.5 shrink-0 text-rose-600" />}
        title="Sentiment"
        note={sentimentNote}
        open={sentimentOpen}
        onToggle={() => setSentimentOpen((o) => !o)}
      >
        <SentimentPanel submissionId={submissionId} canRun={canRun} showTopicTrends={false} />
      </Section>
      <Section
        icon={<Globe2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
        title="Public mood"
        note={moodNote}
        open={moodOpen}
        onToggle={() => setMoodOpen((o) => !o)}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Live social sentiment and industry news on the topics your script touches.</p>
          {moodHasRun && (
            <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={() => runMood()} disabled={moodLoading || !canRun}>
              {moodLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
            </Button>
          )}
        </div>
        {moodLoading && <CheckingNotice what="public mood" compact className="mb-2" />}
        <TopicTrend
          submissionId={submissionId}
          mood={mood}
          isLoading={moodLoading}
          canEdit={canRun}
          busy={dismissTopic.isPending}
          onDismiss={(topicId) => dismissTopic.mutate({ topicId })}
          onRestore={(topicId) => dismissTopic.mutate({ topicId, restore: true })}
          hasRun={moodHasRun}
          onRun={() => runMood()}
        />
      </Section>
    </div>
  );
}
