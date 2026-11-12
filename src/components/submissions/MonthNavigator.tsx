import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Previous / next month around the month shown and how many posts it has, with a way back to this month. "Monthless"
 * (drafts, posts sent back) lists everything waiting, whatever month it's from.
 */
export default function MonthNavigator({
  month,
  onChange,
  monthless,
  loading,
  count,
}: {
  month: Date;
  onChange: (month: Date) => void;
  monthless: boolean;
  loading: boolean;
  /** Posts this month, or (monthless) posts waiting. */
  count: number;
}) {
  const onCurrentMonth = isSameMonth(month, new Date());
  const posts = `${count} ${count === 1 ? "post" : "posts"}`;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <Button variant="outline" size="icon" className="h-9 w-9 bg-card" onClick={() => onChange(addMonths(month, -1))} disabled={monthless} aria-label="Previous month">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="min-w-[140px] text-center leading-tight" aria-live="polite">
        <p className="text-sm font-semibold text-foreground">{monthless ? "All months" : format(month, "MMMM yyyy")}</p>
        <p className="text-xs text-muted-foreground">{loading ? "Loading..." : monthless ? `${posts} waiting on you` : `${posts} this month`}</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 bg-card"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={onCurrentMonth || monthless}
        aria-label="Next month"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      {!onCurrentMonth && !monthless && (
        <button type="button" onClick={() => onChange(startOfMonth(new Date()))} className="ml-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
          This month
        </button>
      )}
    </div>
  );
}
