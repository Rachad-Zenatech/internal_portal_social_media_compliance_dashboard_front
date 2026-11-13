import { useEffect, useRef } from "react";

/**
 * One server-sent-events connection shared by every open tab of the app.
 *
 * The browser allows six connections to one server, across all tabs. Each tab used to keep its own streams open
 * forever, so a few tabs used every connection and the rest of the app (saves, uploads, page loads) queued behind
 * them. Now one tab holds the stream (a Web Lock picks it; when that tab closes, another takes over) and passes each
 * event to the other tabs over a BroadcastChannel. Without those browser features every tab connects as before.
 *
 * `own` tells a handler whether the event arrived on this tab's connection, so something that must happen once
 * (a desktop notification) happens in one tab only.
 */
export interface SharedStreamHandlers {
  onMessage: (data: string, own: boolean) => void;
  onOpen?: (own: boolean) => void;
  onError?: (own: boolean) => void;
}

type Wire = { type: "message"; data: string } | { type: "open" } | { type: "error" };

export function useSharedEventSource(name: string, url: string | null, handlers: SharedStreamHandlers): void {
  // The latest handlers, so changing them doesn't reconnect.
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!url) return;
    const dispatch = (w: Wire, own: boolean) => {
      if (w.type === "message") latest.current.onMessage(w.data, own);
      else if (w.type === "open") latest.current.onOpen?.(own);
      else latest.current.onError?.(own);
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`sse:${name}`) : null;
    if (channel) channel.onmessage = (e: MessageEvent<Wire>) => dispatch(e.data, false);

    let source: EventSource | null = null;
    let release: (() => void) | null = null;
    let stopped = false;
    const connect = () => {
      source = new EventSource(url, { withCredentials: true });
      const send = (w: Wire) => {
        dispatch(w, true);
        channel?.postMessage(w);
      };
      source.onopen = () => send({ type: "open" });
      source.onmessage = (e) => send({ type: "message", data: e.data });
      source.onerror = () => send({ type: "error" });
    };

    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    const waiting = new AbortController();
    if (locks && channel) {
      // Held for as long as this tab keeps the stream; released on cleanup so another tab can take over.
      locks
        .request(`sse:${name}`, { signal: waiting.signal }, () =>
          new Promise<void>((resolve) => {
            release = resolve;
            if (stopped) resolve();
            else connect();
          }),
        )
        .catch(() => undefined); // Aborted while waiting: this tab closed or the URL changed.
    } else {
      connect();
    }

    return () => {
      stopped = true;
      waiting.abort();
      source?.close();
      release?.();
      channel?.close();
    };
  }, [name, url]);
}
