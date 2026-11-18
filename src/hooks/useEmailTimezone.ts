import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { syncEmailTimezone } from "@/services/emailTimezoneService";

/** Refresh on app entry and focus so travel or a device time-zone change is picked up. */
export function useEmailTimezone(): void {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const sync = () => { void syncEmailTimezone(userId).catch(() => undefined); };
    sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [userId]);
}
