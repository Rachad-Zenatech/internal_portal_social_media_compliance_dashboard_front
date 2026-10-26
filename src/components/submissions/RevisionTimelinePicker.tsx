import { addDays, format, isWeekend } from "date-fns";
import { Clock } from "lucide-react";

export type RevisionDays = 1 | 2 | 3 | 5;

const CHOICES: { days: RevisionDays; label: string }[] = [
  { days: 1, label: "1 day" },
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 5, label: "1 week" },
];

// Matches the server: resubmissions are due early enough before the planned publish time to be reviewed again.
const BEFORE_PUBLISH_HOURS = 6;

/** The resubmit-by time the server will set: this many working days from now (weekends skipped), pulled in if the
 * planned publish time is closer. */
export function revisionDueDate(days: RevisionDays, publishAt?: string | null, now = new Date()) {
  let due = now;
  for (let added = 0; added < days; ) {
    due = addDays(due, 1);
    if (!isWeekend(due)) added += 1;
  }
  const latest = publishAt ? new Date(new Date(publishAt).getTime() - BEFORE_PUBLISH_HOURS * 3600_000) : null;
  const capped = Boolean(latest && latest < due);
  const floor = new Date(now.getTime() + 3600_000);
  const result = capped ? latest! : due;
  return { due: result < floor ? floor : result, capped };
}

/**
 * How long the creator has to make the changes: a few quick choices in working days, not a date picker. Shows the
 * date it works out to, and says when the planned publish time pulls it earlier.
 */
export default function RevisionTimelinePicker({
  value,
  onChange,
  publishAt,
}: {
  value: RevisionDays;
  onChange: (days: RevisionDays) => void;
  publishAt?: string | null;
}) {
  const { due, capped } = revisionDueDate(value, publishAt);
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">Time to make the changes</p>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Time to make the changes">
        {CHOICES.map((c) => {
          const on = c.days === value;
          return (
            <button
              key={c.days}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(c.days)}
              className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                on ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="w-3 h-3 mt-px shrink-0" />
        <span>
          Due <span className="font-semibold text-foreground">{format(due, "EEE MMM d, h:mm a")}</span>
          {capped
            ? ", earlier than that because it's planned to publish soon."
            : " (working days; weekends don't count)."}{" "}
          They're reminded before it's due.
        </span>
      </p>
    </div>
  );
}
