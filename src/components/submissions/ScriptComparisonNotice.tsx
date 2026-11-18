import { CheckCircle2, ChevronDown, FileWarning, Loader2 } from "lucide-react";
import type { ScriptMatch } from "@/types/scriptMatch";

function ComparisonPassages({ title, description, passages, more }: {
  title: string; description: string; passages: string[]; more: number;
}) {
  if (!passages.length) return null;
  return (
    <section className="min-w-0 rounded-xl border border-border bg-background p-4">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      <ol aria-label={title} tabIndex={0} className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring">
        {passages.map((text, index) => (
          <li key={`${index}-${text}`} className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-3">
            <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-medium text-muted-foreground">{index + 1}</span>
            <p className="min-w-0 break-words leading-relaxed text-foreground">{text}</p>
          </li>
        ))}
      </ol>
      {more > 0 && <p className="mt-3 text-xs text-muted-foreground">{more} more difference{more === 1 ? "" : "s"} found.</p>}
    </section>
  );
}

function ComparisonDetails({ match }: { match: ScriptMatch }) {
  const hasPassages = match.added.length > 0 || match.missing.length > 0;
  if (!hasPassages) return null;
  return (
    <details className="group mt-4 border-t border-amber-200/70 pt-3 dark:border-amber-500/20">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        View wording differences
        <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">This compares spoken words. Script headings, filming notes and on-screen text may also appear as differences.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ComparisonPassages title="Heard in the video" description="Wording not found in the approved script" passages={match.added} more={match.added_more} />
        <ComparisonPassages title="In the approved script" description="Wording not heard in the video" passages={match.missing} more={match.missing_more} />
      </div>
    </details>
  );
}

function UnfinishedComparison({ pending }: { pending: boolean }) {
  const Icon = pending ? Loader2 : FileWarning;
  const title = pending ? "Comparing your video with the script" : "We couldn't compare your video yet";
  const description = pending ? "Your approved script is saved. The comparison will appear when the video finishes processing."
    : "Your approved script is saved, but we couldn't read the video's speech. Try the compliance check again to compare them.";
  return (
    <div role="status" className="my-3 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-[13px] leading-relaxed">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 text-muted-foreground ${pending ? "motion-safe:animate-spin" : ""}`} />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function ScriptComparisonNotice({ match }: { match: ScriptMatch }) {
  if (match.status === "PENDING" || match.status === "UNAVAILABLE") {
    return <UnfinishedComparison pending={match.status === "PENDING"} />;
  }
  const similarity = match.similarity == null ? null : (
    <span className="inline-flex shrink-0 rounded-full border border-current/15 bg-background/70 px-2.5 py-0.5 text-xs font-medium tabular-nums">
      {match.similarity}% similarity
    </span>
  );
  if (match.status === "MATCH") {
    return (
      <p className="my-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" /> Video follows the approved script {similarity}
      </p>
    );
  }
  const description = match.status === "PARTIAL" ? "Some spoken lines differ from the approved script."
    : "The spoken wording is different from the approved script.";
  return (
    <section aria-label="Video and script comparison" className="my-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-[13px] leading-relaxed dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <FileWarning aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div>
          <div className="flex flex-wrap items-center gap-2 text-foreground">
            <h3 className="font-semibold">Review the video against your script</h3>
            {similarity}
          </div>
          <p className="mt-1 text-muted-foreground">{description}</p>
          <p className="mt-2 text-foreground">Check that you uploaded the right video and review any changes before submitting.</p>
        </div>
      </div>
      <ComparisonDetails match={match} />
    </section>
  );
}
