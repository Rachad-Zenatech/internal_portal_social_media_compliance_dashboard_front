import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isValid, startOfWeek } from "date-fns";

/** Open a calendar link on the selected post's week. */
export function useCalendarSelection() {
  const [params] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => {
    const requested = new Date(params.get("date") ?? "");
    return startOfWeek(isValid(requested) ? requested : new Date(), { weekStartsOn: 1 });
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("post"));
  return { weekStart, setWeekStart, selectedId, setSelectedId };
}
