import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, isValid, startOfWeek, zonedDate } from "@/lib/userDates";
import { useUserTimezone } from "@/hooks/useUserTimezone";

/** Open a calendar link on the selected post's week. */
export function useCalendarSelection() {
  useUserTimezone();
  const [params] = useSearchParams();
  const [weekKey, setWeekKey] = useState(() => {
    const requested = zonedDate(params.get("date") ?? "");
    return format(startOfWeek(isValid(requested) ? requested : zonedDate(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  });
  const weekStart = zonedDate(weekKey);
  const setWeekStart = (next: Date | ((current: Date) => Date)) => {
    const date = typeof next === "function" ? next(weekStart) : next;
    setWeekKey(format(date, "yyyy-MM-dd"));
  };
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("post"));
  return { weekStart, setWeekStart, selectedId, setSelectedId };
}
