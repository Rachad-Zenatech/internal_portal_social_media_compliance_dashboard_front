/** The signed-in person's display zone. Changing it never changes stored timestamps. */
export type TimezonePreference = { time_zone: string; source: "BROWSER" | "MANUAL" };
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Use the abbreviation and offset in effect on this date, including daylight saving. */
export function timezoneOptionLabel(zone: string, date = new Date()): string {
  const name = (style: "short" | "longOffset") => new Intl.DateTimeFormat("en-US", {
    timeZone: zone, timeZoneName: style,
  }).formatToParts(date).find(part => part.type === "timeZoneName")?.value ?? zone;
  const abbreviation = name("short");
  const offset = name("longOffset").replace("GMT", "UTC").replace("UTC+00:00", "UTC");
  const detail = abbreviation.startsWith("GMT") || abbreviation === offset
    ? offset : `${abbreviation} (${offset})`;
  return `${zone.replaceAll("_", " ")} — ${detail}`;
}

let preference: TimezonePreference = { time_zone: browserTimezone(), source: "BROWSER" };
let owner: string | undefined;
const listeners = new Set<() => void>();
export const getUserTimezone = () => preference.time_zone;
export const getTimezonePreference = () => preference;
export function subscribeTimezone(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function activateTimezoneUser(userId?: string): void {
  if (owner === userId) return;
  owner = userId;
  preference = { time_zone: browserTimezone(), source: "BROWSER" };
  listeners.forEach(listener => listener());
}
export function applyTimezone(userId: string, next: TimezonePreference): void {
  if (owner !== userId) return;
  new Intl.DateTimeFormat("en", { timeZone: next.time_zone });
  if (preference.time_zone === next.time_zone && preference.source === next.source) return;
  preference = next;
  listeners.forEach(listener => listener());
}
