import { useCallback } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { recordSproutSend } from "@/lib/contentCalendar";
import type { CalendarItem } from "@/types/calendar";

export function useCalendarSend(onSelected: (id: string) => void) {
  return useCallback(async (item: CalendarItem) => {
    // Keep it open, so the panel shows it as scheduled rather than jumping to the next one.
    onSelected(item.id);
    try { await recordSproutSend(item.id); }
    catch (error) { toast.error((error as Error).message); return; }
    toast.success(`${item.reference_code} sent to Sprout Social (simulated) and scheduled for ${format(new Date(item.scheduled_for), "EEE, MMM d · h:mm a")}.`);
  }, [onSelected]);
}
