import { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import type { CalendarItem } from "@/types/calendar";
import type { SproutRecord } from "@/lib/contentCalendar";

export type SproutState = "NOT_SENT" | "SCHEDULED" | "PUBLISHED" | "MISSED";

export function stateOf(item: CalendarItem, sent: Record<string, SproutRecord>, now: Date): SproutState {
  const due = new Date(item.scheduled_for) <= now;
  if (sent[item.id]) return due ? "PUBLISHED" : "SCHEDULED";
  return due ? "MISSED" : "NOT_SENT";
}

export const STATE: Record<SproutState, { label: string; short: string; dot: string; text: string; box: string }> = {
  NOT_SENT: {
    label: "Approved · not sent to Sprout",
    short: "Not sent",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    box: "bg-amber-50 dark:bg-amber-500/10",
  },
  SCHEDULED: {
    label: "Scheduled in Sprout",
    short: "Scheduled",
    dot: "bg-blue-600",
    text: "text-blue-700 dark:text-blue-300",
    box: "bg-blue-50 dark:bg-blue-500/10",
  },
  PUBLISHED: {
    label: "Published",
    short: "Published",
    dot: "bg-zinc-500",
    text: "text-muted-foreground",
    box: "bg-muted",
  },
  MISSED: {
    label: "Past publish time · not sent",
    short: "Not sent",
    dot: "bg-red-600",
    text: "text-red-700 dark:text-red-400",
    box: "bg-red-50 dark:bg-red-500/10",
  },
};
export const LEGEND: SproutState[] = ["NOT_SENT", "SCHEDULED", "PUBLISHED", "MISSED"];

export const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
export const scoreTone = (s: number) =>
  s >= 90
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
    : s >= 60
    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
