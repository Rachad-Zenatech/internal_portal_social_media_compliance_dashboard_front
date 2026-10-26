import { useSyncExternalStore } from "react";

import { apiClient } from "@/services/apiClient";

/**
 * Link token: what goes in a URL that the browser loads by itself (<img>, <video>, EventSource can't send our
 * Authorization header). The server only accepts it for media and the notification stream, never for the API, and
 * it expires after a few hours, so a link copied from the page or caught in a log can't be used to act as you. The
 * sign-in token itself is never put in a URL.
 *
 * Fetched when the session loads and refreshed every 30 minutes, well before it expires, so links already on the
 * page keep working.
 */

let token: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
  if (next === token) return;
  token = next;
  listeners.forEach((l) => l());
}

/** The current link token, if signed in. */
export function getLinkToken() {
  return token;
}

/** Fetch a fresh link token (needs a signed-in session). */
export async function refreshLinkToken() {
  const res = await apiClient.post<{ token: string; expires_at: string }>("/api/auth/link-token", undefined, { skipGlobalLoading: true });
  set(res.token);
  return res.token;
}

export function clearLinkToken() {
  set(null);
}

/** The link token, re-rendering when it changes (e.g. to reopen the notification stream with the new one). */
export function useLinkToken() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => token
  );
}

/** A media URL with the link token added, for <img>, <video> and similar. */
export function withLinkToken(url: string) {
  return token ? `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : url;
}
