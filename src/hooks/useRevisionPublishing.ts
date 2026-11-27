import { zonedDate } from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { useState } from "react";
import { format, isFuture, isValid } from "@/lib/userDates";
import { toast } from "sonner";

/** Confirm timing before the corrected post is checked and submitted. */
export function useRevisionPublishing(publishDate: Date | undefined, intended: string | null | undefined, onSubmit: () => void) {
  useUserTimezone();
  const [confirmedValue, setConfirmedValue] = useState<string>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const value = publishDate && isValid(publishDate) ? format(publishDate, "yyyy-MM-dd'T'HH:mm") : "";
  const intendedValue = intended && isValid(zonedDate(intended)) ? format(zonedDate(intended), "yyyy-MM-dd'T'HH:mm") : undefined;
  const usesIntendedDate = Boolean(intendedValue && value === intendedValue);
  const dateConfirmed = confirmedValue === value;
  const validDate = Boolean(value && publishDate && isFuture(publishDate));
  const needsConfirmation = usesIntendedDate && !dateConfirmed;
  const onDateConfirmed = (checked: boolean) => setConfirmedValue(checked ? value : undefined);
  const confirm = () => {
    if (needsConfirmation || !publishDate || !isFuture(publishDate)) {
      setConfirmOpen(false);
      toast.error("Confirm the intended date or choose a final publish date and time in the future.");
      return;
    }
    setConfirmOpen(false);
    onSubmit();
  };
  return { value, validDate, usesIntendedDate, dateConfirmed, needsConfirmation, onDateConfirmed, confirmOpen, setConfirmOpen, confirm };
}
