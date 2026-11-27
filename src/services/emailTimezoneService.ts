import { apiClient } from "@/services/apiClient";
import { applyTimezone, browserTimezone, type TimezonePreference } from "@/lib/userTimezone";
const pending = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();

/** Browser detection seeds a new account; the API preserves a manual preference. */
export function syncEmailTimezone(userId: string): Promise<void> {
  const existing = pending.get(userId);
  if (existing) return existing;
  const revision = revisions.get(userId) ?? 0;
  const request = apiClient.put<TimezonePreference>("/api/notifications/timezone", {
    time_zone: browserTimezone(), source: "BROWSER",
  }, { skipGlobalLoading: true }).then(result => {
    if ((revisions.get(userId) ?? 0) === revision) applyTimezone(userId, result);
  })
    .finally(() => { pending.delete(userId); });
  pending.set(userId, request);
  return request;
}
export async function saveUserTimezone(userId: string, timeZone: string): Promise<void> {
  const revision = (revisions.get(userId) ?? 0) + 1;
  revisions.set(userId, revision);
  const result = await apiClient.put<TimezonePreference>("/api/notifications/timezone", {
    time_zone: timeZone, source: "MANUAL",
  }, { skipGlobalLoading: true });
  if (revisions.get(userId) === revision) applyTimezone(userId, result);
}
