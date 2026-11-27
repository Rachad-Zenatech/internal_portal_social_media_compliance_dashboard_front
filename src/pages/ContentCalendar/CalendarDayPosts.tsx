import type { ReactNode } from "react";
import { format } from "date-fns";
import { ChevronDown, Layers } from "lucide-react";
import type { CalendarItem } from "@/types/calendar";
import { groupPublishTimes } from "./groupPublishTimes";

interface Props {
  items: CalendarItem[];
  renderPost: (item: CalendarItem) => ReactNode;
}

/** Collisions stay together while every post keeps its own selectable card. */
export default function CalendarDayPosts({ items, renderPost }: Props) {
  const groups = groupPublishTimes(items);
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => group.length === 1
        ? <div key={group[0].id}>{renderPost(group[0])}</div>
        : <CollisionDeck key={group[0].scheduled_for} items={group} renderPost={renderPost} />)}
    </div>
  );
}

function CollisionDeck({ items, renderPost }: Props) {
  const time = format(new Date(items[0].scheduled_for), "h:mm a");
  return (
    <details className="group/deck min-w-0 rounded-lg border border-blue-200 bg-blue-50/40 shadow-[0_3px_0_-1px_var(--color-background),0_3px_0_0_var(--color-blue-200),0_6px_0_-1px_var(--color-background),0_6px_0_0_var(--color-blue-200)] open:shadow-none dark:border-blue-800 dark:bg-blue-500/5">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <Layers className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-foreground">{time} · {items.length} posts</span>
          <span className="block text-[11px] text-muted-foreground">Same publish time</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/deck:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 border-t border-blue-200 p-1.5 dark:border-blue-800">
        {items.map((item) => <div key={item.id}>{renderPost(item)}</div>)}
      </div>
    </details>
  );
}
