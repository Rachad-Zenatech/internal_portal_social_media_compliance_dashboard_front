import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepFooter } from "./PostStepNav";
import { CaptionComparison } from "@/components/compliance/screener/CaptionComparison";
import { useCreatorReviewUpdates } from "@/hooks/useCreatorReviewUpdates";
import type { IncomingTextChange } from "@/lib/creatorReviewUpdates";

function IncomingChange({ change }: { change: IncomingTextChange }) {
  return <section className="min-w-0 space-y-3 rounded-xl border bg-card p-4">
    <div><h3 className="font-semibold">{change.label}</h3><p className="text-xs text-muted-foreground">Edited by {change.authors.join(", ")}. Compare your original text with the incoming changes.</p></div>
    <CaptionComparison before={change.before} after={change.after} />
  </section>;
}

export default function SubmissionReviewUpdates({ suggestions, textOnly, submissionId, version, hasFeedback, onPublish, onContinue }: {
  suggestions: boolean; textOnly: boolean; submissionId: string | null; version: number; hasFeedback: boolean; onPublish?: () => void; onContinue: () => void;
}) {
  const updates = useCreatorReviewUpdates(suggestions ? submissionId : null, textOnly, version);
  if (!suggestions) return null;
  if (updates.isPending) return <p role="status" className="p-4 text-sm text-muted-foreground">Loading reviewer edits...</p>;
  if (updates.isError) return <div role="alert" className="rounded-xl border p-4">We couldn't load the reviewer edits. <Button variant="outline" onClick={() => void updates.refetch()}>Try again</Button></div>;
  const changes = updates.data.map(change => <IncomingChange key={change.key} change={change} />);
  const noSuggestions = !hasFeedback && !updates.data.length;
  return <div className="space-y-4">
    {noSuggestions && <div className="flex items-start gap-3 rounded-xl border border-green-300 bg-green-50 p-5 text-green-950 dark:bg-green-950 dark:text-green-100"><CheckCircle2 className="size-6 shrink-0" /><div><h2 className="text-lg font-semibold">Good to post!</h2><p className="text-sm">No suggestions or text edits. Your existing checks can be reused while the content stays unchanged. Confirm your publish date before publishing.</p></div></div>}
    {changes}
    <StepFooter next={{ label: noSuggestions && onPublish ? "Continue to publish" : "Continue to make the changes", onClick: noSuggestions && onPublish ? onPublish : onContinue }} />
  </div>;
}
