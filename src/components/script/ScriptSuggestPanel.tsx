import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, PencilLine, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScriptActions } from "@/hooks/useScript";
import type { ScriptHighlight, ScriptSuggestion } from "@/types/script";

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/**
 * The bottom of the script panel for a suggesting reviewer, in place of the reviewer's decision: they edit the script and
 * leave notes on wording, then save it as a suggestion. It is theirs alone for now, and approving, requesting changes
 * and scheduling stay with the reviewers.
 */
export default function ScriptSuggestPanel({
  submissionId,
  sentBody,
  draft,
  highlights,
  saved,
  onDiscarded,
}: {
  submissionId: string;
  /** The script as it was sent (what a suggestion is measured against). */
  sentBody: string;
  /** Their wording now, and their notes. */
  draft: string;
  highlights: ScriptHighlight[];
  /** What they saved last, if anything. */
  saved: ScriptSuggestion | null;
  /** The saved suggestion was taken back: put the script and notes back as sent. */
  onDiscarded: () => void;
}) {
  const { saveSuggestion, discardSuggestion } = useScriptActions(submissionId);
  const edited = !same(draft, sentBody);
  const notes = highlights.length;
  // Changed since the last save (or nothing saved yet and something to save).
  const dirty = useMemo(() => {
    const savedBody = saved?.body ?? sentBody;
    const savedNotes = JSON.stringify(saved?.highlights ?? []);
    return !same(draft, savedBody) || JSON.stringify(highlights) !== savedNotes;
  }, [draft, highlights, saved, sentBody]);
  const pending = saveSuggestion.isPending || discardSuggestion.isPending;
  const nothing = !edited && notes === 0;

  return (
    <div className="flex flex-col gap-2.5 border-t border-border/70 bg-muted/40 px-4 py-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        <PencilLine className="h-4 w-4 text-blue-600" /> You&apos;re suggesting
      </div>
      <p className="text-xs text-muted-foreground">
        Edit the script and highlight or comment on wording, then save it as your suggestion. It is private to you for now.
        Approving, requesting changes and scheduling are for the reviewer.
      </p>
      <p className={`text-xs font-medium ${dirty ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
        {nothing && !saved
          ? "Nothing suggested yet."
          : `${edited ? "Edited" : "Not edited"} · ${notes} note${notes === 1 ? "" : "s"}${
              dirty ? " · unsaved changes" : saved ? ` · saved ${formatDistanceToNow(new Date(saved.updated_at), { addSuffix: true })}` : ""
            }`}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          className="h-10 flex-1 bg-blue-700 text-white hover:bg-blue-800"
          disabled={pending || !dirty}
          onClick={() => saveSuggestion.mutate({ text: draft, highlights })}
        >
          {saveSuggestion.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save suggestion
        </Button>
        {saved && (
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-1.5"
            disabled={pending}
            onClick={() => discardSuggestion.mutate(undefined, { onSuccess: onDiscarded })}
          >
            {discardSuggestion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Discard
          </Button>
        )}
      </div>
    </div>
  );
}
