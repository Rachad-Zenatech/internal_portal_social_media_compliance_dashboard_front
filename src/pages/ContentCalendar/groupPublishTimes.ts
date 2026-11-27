import type { CalendarItem } from "@/types/calendar";

/** Compare instants so equivalent timestamps with different offsets share a deck. */
export function groupPublishTimes(items: CalendarItem[]): CalendarItem[][] {
  const groups = new Map<number, CalendarItem[]>();
  for (const item of items) {
    const instant = new Date(item.scheduled_for).getTime();
    const group = groups.get(instant);
    if (group) group.push(item);
    else groups.set(instant, [item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}
