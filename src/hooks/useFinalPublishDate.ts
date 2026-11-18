import { useState } from "react";
import { format, isFuture, isValid } from "date-fns";

/** Keep the creator's final timing separate from the approved, intended date. */
export function useFinalPublishDate(key: string, intended?: string, saved?: string) {
  const [selection, setSelection] = useState<{ key: string; value: string }>();
  const initial = intended && isValid(new Date(intended))
    ? format(new Date(intended), "yyyy-MM-dd'T'HH:mm") : "";
  const value = selection?.key === key ? selection.value : initial;
  const date = new Date(saved ?? value);
  const valid = isValid(date);
  const error = !value ? "Choose a final publish date and time."
    : !valid ? "Choose a valid final publish date and time."
    : !isFuture(date) ? "Choose a final publish date and time in the future." : undefined;

  return {
    value: saved && valid ? format(date, "yyyy-MM-dd'T'HH:mm") : value,
    date: valid ? date : undefined,
    error: saved ? undefined : error,
    onChange: (next: string) => setSelection({ key, value: next }),
  };
}
