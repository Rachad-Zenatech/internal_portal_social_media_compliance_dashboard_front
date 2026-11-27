import { zonedDate } from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { useState } from "react";
import { format, isFuture, isValid } from "@/lib/userDates";

/** Keep the creator's final timing separate from the approved, intended date. */
export function useFinalPublishDate(key: string, intended?: string, saved?: string) {
  useUserTimezone();
  const [selection, setSelection] = useState<{ key: string; iso: string }>();
  const instant = saved ?? (selection?.key === key ? selection.iso : intended ?? "");
  const date = zonedDate(instant);
  const valid = isValid(date);
  const value = valid ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
  const error = !instant ? "Choose a final publish date and time."
    : !valid ? "Choose a valid final publish date and time."
    : !isFuture(date) ? "Choose a final publish date and time in the future." : undefined;

  return {
    value: saved && valid ? format(date, "yyyy-MM-dd'T'HH:mm") : value,
    date: valid ? date : undefined,
    error: saved ? undefined : error,
    onChange: (next: string) => {
      const picked = zonedDate(next);
      setSelection({ key, iso: isValid(picked) ? picked.toISOString() : "" });
    },
  };
}
