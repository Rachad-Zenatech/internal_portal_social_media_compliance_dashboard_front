import type { ReactNode } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import type { CalendarItem } from "@/types/calendar";
import CalendarDayPosts from "./CalendarDayPosts";

interface Props {
  view: "week" | "month" | "list";
  days: Date[];
  month: Date;
  isReviewer: boolean;
  onDay: (day: Date) => CalendarItem[];
  openWeek: (day: Date) => void;
  renderPost: (item: CalendarItem) => ReactNode;
  renderSummary: (item: CalendarItem, compact: boolean) => ReactNode;
}

export default function CalendarViews(props: Props) {
  if (props.view === "month") return <MonthView {...props} />;
  if (props.view === "list") return <ListView {...props} />;
  return <WeekView {...props} />;
}

function WeekView({ days, isReviewer, onDay, renderPost }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[960px] grid-cols-[repeat(7,minmax(0,1fr))]">
        {days.map((day) => (
          <div key={day.toISOString()} className={`flex min-h-[560px] min-w-0 flex-col border-r border-border/50 last:border-r-0 ${isToday(day) ? "bg-blue-50/40 dark:bg-blue-500/5" : ""}`}>
            <WeekHeader day={day} isReviewer={isReviewer} />
            <div className="p-1.5 pb-3"><CalendarDayPosts items={onDay(day)} renderPost={renderPost} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekHeader({ day, isReviewer }: { day: Date; isReviewer: boolean }) {
  const today = isToday(day);
  return (
    <div className={`flex items-center justify-between border-b border-border/70 px-2.5 py-2 ${today ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}>
      <span className={`text-[13px] font-semibold ${today ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>{format(day, "EEE d")}</span>
      {!isReviewer && <Link to="/submissions/new" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted" aria-label={`New post for ${format(day, "EEEE, MMM d")}`}><Plus className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

function MonthView(props: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30 text-center text-xs font-medium text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-1.5">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {props.days.map((day) => <MonthDay key={day.toISOString()} day={day} {...props} />)}
        </div>
      </div>
    </div>
  );
}

function MonthDay({ day, month, onDay, openWeek, renderSummary }: Props & { day: Date }) {
  const items = onDay(day);
  return (
    <div className={`min-h-[118px] min-w-0 border-b border-r border-border/50 p-1.5 pb-3 ${isSameMonth(day, month) ? "" : "bg-muted/20"}`}>
      <button type="button" onClick={() => openWeek(day)} title="Open this week" className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${isToday(day) ? "bg-blue-700 text-white" : "text-foreground hover:bg-muted"}`}>{format(day, "d")}</button>
      <CalendarDayPosts items={items} renderPost={(item) => renderSummary(item, true)} />
    </div>
  );
}

function ListView({ days, onDay, renderSummary }: Props) {
  const activeDays = days.filter((day) => onDay(day).length > 0);
  if (!activeDays.length) return <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing approved for this week.</p>;
  return (
    <div className="divide-y divide-border/60">
      {activeDays.map((day) => (
        <div key={day.toISOString()}>
          <p className={`bg-muted/30 px-4 py-1.5 text-xs font-semibold ${isToday(day) ? "text-blue-700 dark:text-blue-300" : "text-muted-foreground"}`}>{format(day, "EEEE, MMM d")}{isToday(day) && " · Today"}</p>
          <div className="p-2 pb-3"><CalendarDayPosts items={onDay(day)} renderPost={(item) => renderSummary(item, false)} /></div>
        </div>
      ))}
    </div>
  );
}
