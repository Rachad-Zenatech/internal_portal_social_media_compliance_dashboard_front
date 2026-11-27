import { Clock3 } from "lucide-react";
import { format } from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { suggestionTimeLabel, type postSuggestionState } from "@/lib/postApprovalSuggestions";

export default function PostApprovalSuggestionNotice({ access }: { access: ReturnType<typeof postSuggestionState> }) {
  const { time_zone } = useUserTimezone();
  if (!Number.isFinite(access.deadline)) return null;
  const until = format(new Date(access.deadline), "EEE, MMM d 'at' h:mm a") + ` (${time_zone})`;
  const title = access.reviewing ? "Approval deadline" : access.open ? "Suggestions open" : "Suggestions closed";
  const countdown = access.reviewing && access.overdueMs > 0 ? `Overdue by ${suggestionTimeLabel(access.overdueMs)}`
    : access.remainingMs > 0 ? `${suggestionTimeLabel(access.remainingMs)} remaining` : "Deadline reached";
  const message = access.reviewing ? `Review and leave feedback by ${until}.`
    : access.pending ? access.open ? `Suggestions close ${until}. The creator receives the decision afterward.`
      : "The saved decision is being handed back to the creator."
    : access.open ? `Suggestions close ${until}. Publishing opens afterward.`
      : "The creator can now choose the final publish date.";
  return (
    <div className="shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2" role="status">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium"><Clock3 className="size-3.5" />{title}</p>
        <span className="font-mono text-[11px] tabular-nums" aria-label="Deadline countdown">{countdown}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}
