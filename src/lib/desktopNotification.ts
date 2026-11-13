/** A desktop (Windows) notification, when the user allowed them. Clicking it focuses the app and opens linkUrl. */
export function sendWindowsNotification(
  title: string,
  message: string,
  linkUrl?: string,
  onNavigate?: (url: string) => void
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body: message,
      icon: "/favicon.svg",
      tag: `app-${Date.now()}`,
      silent: false,
    });

    notif.onclick = (e) => {
      e.preventDefault();
      try {
        window.focus();
      } catch {
        // Ignored
      }
      if (linkUrl) {
        if (onNavigate) {
          onNavigate(linkUrl);
        } else {
          window.location.href = linkUrl;
        }
      }
      notif.close();
    };
  } catch (err) {
    console.warn("Failed to show Windows desktop notification:", err);
  }
}
