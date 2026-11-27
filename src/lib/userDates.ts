/** Calendar math and formatting in the saved user zone; instants remain UTC. */
import * as dates from "date-fns";
import { TZDate, tz } from "@date-fns/tz";
import { getUserTimezone } from "./userTimezone";
export * from "date-fns";

const context = () => ({ in: tz(getUserTimezone()) });
export const format = (...[date, pattern, options]: Parameters<typeof dates.format>) => dates.format(date, pattern, { ...context(), ...options });
export const parse = (...[value, pattern, reference, options]: Parameters<typeof dates.parse>) => dates.parse(value, pattern, reference, { ...context(), ...options });
export const addDays = (...[date, amount, options]: Parameters<typeof dates.addDays>) => dates.addDays(date, amount, { ...context(), ...options });
export const addWeeks = (...[date, amount, options]: Parameters<typeof dates.addWeeks>) => dates.addWeeks(date, amount, { ...context(), ...options });
export const addMonths = (...[date, amount, options]: Parameters<typeof dates.addMonths>) => dates.addMonths(date, amount, { ...context(), ...options });
export const addBusinessDays = (...[date, amount, options]: Parameters<typeof dates.addBusinessDays>) => dates.addBusinessDays(date, amount, { ...context(), ...options });
export const setHours = (...[date, value, options]: Parameters<typeof dates.setHours>) => dates.setHours(date, value, { ...context(), ...options });
export const setMinutes = (...[date, value, options]: Parameters<typeof dates.setMinutes>) => dates.setMinutes(date, value, { ...context(), ...options });
export const startOfDay = (...[date, options]: Parameters<typeof dates.startOfDay>) => dates.startOfDay(date, { ...context(), ...options });
export const endOfDay = (...[date, options]: Parameters<typeof dates.endOfDay>) => dates.endOfDay(date, { ...context(), ...options });
export const startOfWeek = (...[date, options]: Parameters<typeof dates.startOfWeek>) => dates.startOfWeek(date, { ...context(), ...options });
export const endOfWeek = (...[date, options]: Parameters<typeof dates.endOfWeek>) => dates.endOfWeek(date, { ...context(), ...options });
export const startOfMonth = (...[date, options]: Parameters<typeof dates.startOfMonth>) => dates.startOfMonth(date, { ...context(), ...options });
export const endOfMonth = (...[date, options]: Parameters<typeof dates.endOfMonth>) => dates.endOfMonth(date, { ...context(), ...options });
export const startOfHour = (...[date, options]: Parameters<typeof dates.startOfHour>) => dates.startOfHour(date, { ...context(), ...options });
export const isSameDay = (...[a, b, options]: Parameters<typeof dates.isSameDay>) => dates.isSameDay(a, b, { ...context(), ...options });
export const isSameMonth = (...[a, b, options]: Parameters<typeof dates.isSameMonth>) => dates.isSameMonth(a, b, { ...context(), ...options });
export const isToday = (...[date, options]: Parameters<typeof dates.isToday>) => dates.isToday(date, { ...context(), ...options });
export const isTomorrow = (...[date, options]: Parameters<typeof dates.isTomorrow>) => dates.isTomorrow(date, { ...context(), ...options });
export const isYesterday = (...[date, options]: Parameters<typeof dates.isYesterday>) => dates.isYesterday(date, { ...context(), ...options });
export const isWeekend = (...[date, options]: Parameters<typeof dates.isWeekend>) => dates.isWeekend(date, { ...context(), ...options });
export const differenceInCalendarDays = (...[a, b, options]: Parameters<typeof dates.differenceInCalendarDays>) => dates.differenceInCalendarDays(a, b, { ...context(), ...options });
export const eachDayOfInterval = (...[interval, options]: Parameters<typeof dates.eachDayOfInterval>) => dates.eachDayOfInterval(interval, { ...context(), ...options });

/** Parse wall-clock input in a named zone, rejecting times skipped by daylight saving. */
export function wallTimeDate(value: string, zone = getUserTimezone()): TZDate {
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!parts) return new TZDate(NaN, zone);
  const [, y, m, d, h = "00", min = "00", s = "00"] = parts;
  const date = new TZDate(+y, +m - 1, +d, +h, +min, +s, zone);
  if (dates.format(date, "yyyy-MM-dd'T'HH:mm:ss") !== `${y}-${m}-${d}T${h}:${min}:${s}`) return new TZDate(NaN, zone);
  // A repeated hour resolves to its first occurrence, consistently across devices.
  for (let delta = 180; delta > 0; delta -= 15) {
    const earlier = new TZDate(date.getTime() - delta * 60_000, zone);
    if (dates.format(earlier, "yyyy-MM-dd'T'HH:mm:ss") === dates.format(date, "yyyy-MM-dd'T'HH:mm:ss")) return earlier;
  }
  return date;
}

/** Explicit-offset ISO input preserves its instant; offset-free picker input is local to the user. */
export function zonedDate(value: string | number | Date = Date.now()): TZDate {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) return wallTimeDate(value);
  return new TZDate(new Date(value).getTime(), getUserTimezone());
}

/** Set a picked calendar day's clock time without using the device's zone. */
export function withWallTime(date: Date, time: string): TZDate {
  return wallTimeDate(format(date, "yyyy-MM-dd") + "T" + time);
}
