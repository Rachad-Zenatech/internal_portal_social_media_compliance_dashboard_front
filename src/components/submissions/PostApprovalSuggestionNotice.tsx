import { Clock3 } from "lucide-react";
import { format } from "date-fns";
import { suggestionTimeLabel, type postSuggestionState } from "@/lib/postApprovalSuggestions";

export default function PostApprovalSuggestionNotice({ access }: { access: ReturnType<typeof postSuggestionState> }) {
  if (!access.approved || !Number.isFinite(access.deadline)) return null;
  const until = format(new Date(access.deadline), "EEE, MMM d · h:mm a");
  const message = access.open
    ? "Approved. Other reviewers can leave suggestions until " + until + ". Publishing opens after this deadline."
    : "Suggestion window closed. Other reviewers' notes are read-only. The creator can now choose the final publish date.";
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm" role="status">
      <p className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4" />{access.open ? "Suggestions open" : "Suggestions closed"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      {access.open && <p className="mt-1 font-mono text-sm" aria-label="Time remaining for suggestions">{suggestionTimeLabel(access.remainingMs)} remaining</p>}
    </div>
  );
}
