import { useState } from "react";
import { format, isFuture, isValid } from "date-fns";
import { toast } from "sonner";
import { recordSproutSend, useSentToSprout } from "@/lib/contentCalendar";
import { useFinalPublishDate } from "@/hooks/useFinalPublishDate";

/** Confirm timing and add approved content to the existing simulated calendar. */
export function useApprovedPublishing(submissionId: string, intended?: string | null) {
  const itemId = `sub-${submissionId}`;
  const scheduled = useSentToSprout()[itemId]?.scheduled_for;
  const finalDate = useFinalPublishDate(submissionId, intended ?? undefined, scheduled);
  const [confirmedDate, setConfirmedDate] = useState<string>();
  const intendedValue = intended && isValid(new Date(intended)) ? format(new Date(intended), "yyyy-MM-dd'T'HH:mm") : undefined;
  const usesIntendedDate = Boolean(intendedValue && finalDate.value === intendedValue);
  const dateConfirmed = confirmedDate === finalDate.value;
  const needsDateConfirmation = usesIntendedDate && !dateConfirmed && !scheduled;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirm = () => {
    if (scheduled) return;
    if (needsDateConfirmation) {
      toast.error("Confirm the intended publish date or choose a different date.");
      return;
    }
    if (!finalDate.date || !isFuture(finalDate.date)) {
      setConfirmOpen(false);
      toast.error("Choose a final publish date and time in the future.");
      return;
    }
    recordSproutSend(itemId, finalDate.date.toISOString());
    setConfirmOpen(false);
    toast.success("Post added to the calendar (simulated).");
  };
  const onDateConfirmed = (checked: boolean) => setConfirmedDate(checked ? finalDate.value : undefined);
  return { finalDate, scheduled, confirmOpen, setConfirmOpen, confirm, usesIntendedDate, dateConfirmed, needsDateConfirmation, onDateConfirmed };
}
