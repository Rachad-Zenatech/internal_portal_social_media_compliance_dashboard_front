import { useEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parse, startOfDay } from "date-fns";
import { CalendarDays, Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE = "yyyy-MM-dd";
const DATE_TIME = "yyyy-MM-dd'T'HH:mm";
const DEFAULT_TIME = "09:00";
// Every half hour, 6 AM to 10 PM; a time picked elsewhere (e.g. 10:15) is added to the list.
const TIMES = Array.from({ length: 33 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function parseValue(value: string | null | undefined, withTime: boolean): Date | undefined {
  if (!value) return undefined;
  const d = parse(value.slice(0, withTime ? 16 : 10), withTime ? DATE_TIME : DATE, new Date());
  return isValid(d) ? d : undefined;
}

const timeLabel = (t: string) => format(parse(t, "HH:mm", new Date()), "h:mm a");

/**
 * The portal's date picker, in place of the browser's: a calendar (and, with `withTime`, a column of times) in a
 * popover. Takes and gives the same strings as <input type="date"> ("2026-11-14") or type="datetime-local"
 * ("2026-11-14T09:00"), so it drops in where those were. An empty string means no date.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  withTime = false,
  disabled = false,
  disablePast = false,
  placeholder = "Pick a date",
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  withTime?: boolean;
  disabled?: boolean;
  /** Days before today can't be picked. */
  disablePast?: boolean;
  placeholder?: string;
  /** For the trigger box, e.g. a red border when the value is wrong. */
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const picked = useMemo(() => parseValue(value, withTime), [value, withTime]);
  const time = picked && withTime ? format(picked, "HH:mm") : DEFAULT_TIME;
  const times = useMemo(() => (TIMES.includes(time) ? TIMES : [...TIMES, time].sort()), [time]);

  // Open on the picked time in the list.
  const timeList = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open || !withTime) return;
    const id = window.setTimeout(() => {
      timeList.current?.querySelector<HTMLElement>("[data-picked='true']")?.scrollIntoView({ block: "center" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, withTime]);

  const emit = (day: Date, t: string) => {
    if (!withTime) return onChange(format(day, DATE));
    const [h, m] = t.split(":").map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    onChange(format(d, DATE_TIME));
  };

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <div
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className="min-w-0 flex-1 truncate text-left outline-none disabled:cursor-not-allowed"
          >
            {picked ? (
              format(picked, withTime ? "EEE, MMM d, yyyy · h:mm a" : "MMM d, yyyy")
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </button>
        </PopoverTrigger>
        {picked && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Clear date"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          <Calendar
            mode="single"
            selected={picked}
            defaultMonth={picked}
            onSelect={(d) => {
              if (!d) return;
              emit(d, time);
              if (!withTime) setOpen(false);
            }}
            disabled={disablePast ? { before: startOfDay(new Date()) } : undefined}
          />
          {withTime && (
            <div className="flex w-32 flex-col border-l border-border/70">
              <p className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2.5 text-xs font-semibold text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Time
              </p>
              <div ref={timeList} className="max-h-[260px] flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Time">
                {times.map((t) => {
                  const on = Boolean(picked) && t === time;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="option"
                      aria-selected={on}
                      data-picked={t === time}
                      onClick={() => emit(picked ?? startOfDay(new Date()), t)}
                      className={cn(
                        "w-full rounded-md px-2.5 py-1.5 text-left text-xs tabular-nums transition-colors",
                        on ? "bg-blue-700 font-semibold text-white" : "text-foreground hover:bg-accent"
                      )}
                    >
                      {timeLabel(t)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button type="button" size="sm" className="h-7 bg-blue-700 text-xs text-white hover:bg-blue-800" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
