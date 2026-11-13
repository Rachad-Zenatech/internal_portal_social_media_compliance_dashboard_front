import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSharedEventSource } from "@/hooks/useSharedEventSource";
import { useAuth } from "@/lib/AuthContext";
import { sendWindowsNotification } from "@/lib/desktopNotification";
import { useLinkToken } from "@/lib/linkToken";
import { BASE_URL } from "@/services/apiClient";

type LiveNotification = { user_id?: string; title?: string; message?: string; link_url?: string };

/**
 * Live notifications: refresh the lists and counts, show a toast (inAppAlerts) and a desktop alert
 * (windowsNotifications). One tab holds the stream for all of them (see useSharedEventSource); every tab updates and
 * shows the toast, and only that tab sends the desktop alert, so it appears once however many tabs are open.
 */
export function useNotificationStream({ inAppAlerts, windowsNotifications }: { inAppAlerts: boolean; windowsNotifications: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // EventSource can't send headers, so it connects with the link token (stream-only); a new one reopens it.
  const linkToken = useLinkToken();
  const connectedBefore = useRef(false);

  const isForMe = (n: LiveNotification) => {
    const me = user?.id || (user as { sub?: string } | null)?.sub;
    const to = String(n.user_id ?? "").toLowerCase();
    return !n.user_id || n.user_id === "*" || (me && to === String(me).toLowerCase()) ||
      (user?.email && to === String(user.email).toLowerCase());
  };

  const show = (n: LiveNotification, own: boolean) => {
    const title = n.title ? n.title.charAt(0).toUpperCase() + n.title.slice(1) : "System Notification";
    if (inAppAlerts) {
      toast(
        <div className="cursor-pointer w-full flex flex-col gap-1" onClick={() => n.link_url && navigate(n.link_url)}>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-slate-500 dark:text-zinc-400 whitespace-pre-line">{n.message}</div>
        </div>,
        { position: "bottom-right", duration: 5000, closeButton: true },
      );
    }
    if (own && windowsNotifications) {
      sendWindowsNotification(title, n.message || "New notification received", n.link_url, (url) => navigate(url));
    }
  };

  useSharedEventSource(
    "notifications",
    linkToken ? `${BASE_URL || ""}/api/notifications/stream?token=${encodeURIComponent(linkToken)}` : null,
    {
      // The server ends each stream every couple of minutes and the browser reconnects; catch up on anything sent between.
      onOpen: () => {
        if (connectedBefore.current) queryClient.invalidateQueries({ queryKey: ["notifications"] });
        connectedBefore.current = true;
      },
      onMessage: (data, own) => {
        try {
          const n = JSON.parse(data) as LiveNotification;
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
          if (isForMe(n)) show(n, own);
        } catch (err) {
          console.error("Failed to parse SSE notification:", err);
        }
      },
    },
  );
}
