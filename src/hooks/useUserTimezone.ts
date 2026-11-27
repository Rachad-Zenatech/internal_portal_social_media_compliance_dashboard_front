import { useSyncExternalStore } from "react";
import { getTimezonePreference, subscribeTimezone } from "@/lib/userTimezone";

export function useUserTimezone() {
  return useSyncExternalStore(subscribeTimezone, getTimezonePreference, getTimezonePreference);
}
