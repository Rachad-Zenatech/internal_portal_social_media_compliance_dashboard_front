import { apiClient } from "@/services/apiClient";

const saved = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

/** Save the signed-in person's browser time zone; the API identifies the user from their session. */
export async function syncEmailTimezone(userId: string): Promise<void> {
  let timeZone: string;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return;
  }
  if (!timeZone || saved.get(userId) === timeZone) return;
  const key = `${userId}:${timeZone}`;
  if (pending.has(key)) return pending.get(key);
  const request = apiClient.put("/api/notifications/email-timezone", { time_zone: timeZone })
    .then(() => { saved.set(userId, timeZone); })
    .finally(() => { pending.delete(key); });
  pending.set(key, request);
  return request;
}
