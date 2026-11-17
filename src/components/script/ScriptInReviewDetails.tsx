import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ScriptCompliance from "@/components/script/ScriptCompliance";
import ScriptDocumentPreview from "@/components/script/ScriptDocumentPreview";
import { scriptService } from "@/services/scriptService";
import { useScriptReviewerLabel } from "@/hooks/useScriptReviewerLabel";
import type { SubmissionSummary } from "@/types/submission";
import type { ScriptStage } from "@/types/script";

/** The exact submitted script and saved check, without draft/video editing controls. */
export default function ScriptInReviewDetails({ summary, stage: suppliedStage, reviewerMode = false }: {
  summary: Pick<SubmissionSummary, "id" | "reference_code" | "title">; stage?: ScriptStage; reviewerMode?: boolean;
}) {
  const query = useQuery({ queryKey: ["script", summary.id], queryFn: () => scriptService.get(summary.id), staleTime: 0, enabled: !suppliedStage });
  const stage = suppliedStage ?? query.data;
  const submitted = [...(stage?.versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
  const check = submitted?.check ?? stage?.precheck;
  const script = submitted?.body ?? stage?.file_text ?? "";
  const reviewerLabel = useScriptReviewerLabel(summary.id, stage?.reviewer_names, Boolean(stage));
  const terms = (check?.violations ?? []).filter((finding) => finding.status !== "CLEARED").flatMap((finding) => finding.flagged_terms);
  const completed = ["Post details", "Compliance rules", "Sent for review"].map((label) => (
    <li key={label} className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4 shrink-0" />{label}</li>
  ));
  if (!suppliedStage && query.isLoading) return <p role="status" className="flex items-center gap-2 p-6"><Loader2 className="size-4 animate-spin" />Loading submitted script...</p>;
  if (!suppliedStage && query.isError) return <div role="alert" className="space-y-3 p-6"><p>Couldn't load the submitted script.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>;
  return (
    <div className="space-y-5 rounded-xl border border-border/70 bg-card p-5 text-card-foreground shadow-xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Script in review &middot; {summary.reference_code}</p>
          <h2 className="mt-1 text-lg font-bold">{summary.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{reviewerLabel}</p></div>
        {reviewerMode && stage?.can_review && <Button asChild><Link to={`/script-review/scripts/${summary.id}`}>Review script</Link></Button>}
      </header>
      <ol aria-label="Completed script preparation" className="flex flex-wrap gap-4 rounded-xl border border-border p-3">{completed}</ol>
      <section aria-label="Submitted script" className="min-w-0"><ScriptDocumentPreview text={script} terms={terms} /></section>
      <section aria-label="Saved compliance check" className="space-y-3 border-t border-border pt-4">
        <div><h3 className="font-semibold">Compliance at submission</h3><p className="mt-1 text-xs text-muted-foreground">The saved check for the submitted script. Opening this view does not run another check.</p></div>
        {check ? <ScriptCompliance check={check} /> : <p className="text-sm text-muted-foreground">No saved compliance result is available for this submitted version.</p>}
      </section>
    </div>
  );
}
