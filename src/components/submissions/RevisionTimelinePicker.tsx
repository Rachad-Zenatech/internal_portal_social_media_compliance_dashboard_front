import { addDays, format, isWeekend, setHours, setMinutes } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type RevisionDays = 1 | 2 | 3 | 5;

/** What the reviewer chose: a few working days, an exact date and time, or (where it's optional) no deadline. */
export type Timeline = { kind: "days"; days: RevisionDays } | { kind: "date"; at: Date | null } | { kind: "none" };

export const DEFAULT_TIMELINE: Timeline = { kind: "days", days: 1 };

/** Whether the choice can be sent: a picked date has to be set and still ahead. */
export const timelineValid = (t: Timeline, now = new Date()) => t.kind !== "date" || Boolean(t.at && t.at > now);

/** The choice as the fields the server takes: `days` or `at` (an ISO time), or neither for no deadline. */
export const timelineFields = (t: Timeline): { days?: RevisionDays; at?: string } =>
  t.kind === "days" ? { days: t.days } : t.kind === "date" && t.at ? { at: t.at.toISOString() } : {};

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

const pill = (on: boolean) =>
  `rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
    on ? "border-blue-600 bg-blue-600 text-white" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
  }`;

/**
 * How long the creator has to do the next thing: a few quick choices in working days, or a date and time picked by
 * hand. Shows the date it works out to, and says when the planned publish time pulls it earlier (or a picked date
 * falls after it). allowNone adds "No deadline" for steps where one is optional.
 */
export default function RevisionTimelinePicker({
  value,
  onChange,
  publishAt,
  label = "Time to make the changes",
  allowNone = false,
}: {
  value: Timeline;
  onChange: (t: Timeline) => void;
  publishAt?: string | null;
  label?: string;
  allowNone?: boolean;
}) {
  const days = value.kind === "days" ? revisionDueDate(value.days, publishAt) : null;
  const picked = value.kind === "date" ? value.at : null;
  const pickedPast = Boolean(picked && picked <= new Date());
  const afterPublish = Boolean(picked && publishAt && picked > new Date(publishAt));
  const time = picked ? format(picked, "HH:mm") : "17:00";

  const setDay = (d: Date | undefined) => {
    if (!d) return;
    const [h, m] = time.split(":").map(Number);
    onChange({ kind: "date", at: setMinutes(setHours(d, h), m) });
  };
  const setTime = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    onChange({ kind: "date", at: setMinutes(setHours(picked ?? addDays(new Date(), 1), h), m) });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className={`grid gap-1.5 ${allowNone ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-5"}`} role="radiogroup" aria-label={label}>
        {CHOICES.map((c) => (
          <button
            key={c.days}
            type="button"
            role="radio"
            aria-checked={value.kind === "days" && value.days === c.days}
            onClick={() => onChange({ kind: "days", days: c.days })}
            className={pill(value.kind === "days" && value.days === c.days)}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={value.kind === "date"}
          onClick={() => onChange({ kind: "date", at: picked ?? setMinutes(setHours(addDays(new Date(), 1), 17), 0) })}
          className={pill(value.kind === "date")}
        >
          Pick a date
        </button>
        {allowNone && (
          <button type="button" role="radio" aria-checked={value.kind === "none"} onClick={() => onChange({ kind: "none" })} className={pill(value.kind === "none")}>
            No deadline
          </button>
        )}
      </div>

      {value.kind === "date" && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 text-left text-sm ${pickedPast || !picked ? "border-red-500" : "border-input"}`}
              >
                <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{picked ? format(picked, "EEE, MMM d, yyyy") : <span className="text-muted-foreground">Pick a date</span>}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar mode="single" selected={picked ?? undefined} onSelect={setDay} disabled={{ before: new Date() }} />
            </PopoverContent>
          </Popover>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-[7.5rem]" aria-label="Time" />
        </div>
      )}

      <p className={`flex items-start gap-1.5 text-[11px] ${pickedPast ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
        <Clock className="w-3 h-3 mt-px shrink-0" />
        {value.kind === "none" ? (
          <span>No deadline. They can upload it whenever they're ready.</span>
        ) : value.kind === "date" ? (
          <span>
            {!picked ? (
              "Pick the date it's due."
            ) : pickedPast ? (
              "That time has passed. Pick a time that's still ahead."
            ) : (
              <>
                Due <span className="font-semibold text-foreground">{format(picked, "EEE MMM d, h:mm a")}</span>
                {afterPublish ? ", which is after the planned publish time." : "."} They're reminded before it's due.
              </>
            )}
          </span>
        ) : (
          <span>
            Due <span className="font-semibold text-foreground">{format(days!.due, "EEE MMM d, h:mm a")}</span>
            {days!.capped ? ", earlier than that because it's planned to publish soon." : " (working days; weekends don't count)."} They're reminded
            before it's due.
          </span>
        )}
      </p>
    </div>
  );
}
