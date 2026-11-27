import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocNote, ScriptFocusRequest } from "@/types/scriptDoc";

// Fallback refresh interval when the server doesn't specify expires_in (15-minute token -> refresh at 10 minutes).
const FALLBACK_REFRESH_MS = 10 * 60 * 1000;
const EXPIRY_BUFFER_MS = 30 * 1000;

/** Messages the shared editor sends this page (see the Share Document front's lib/embedBridge.ts). */
const NEWS = new Set(["script-embed:status", "script-embed:merge-completed", "script-embed:post-requested"]);
const AUTH_REQUIRED = "script-embed:auth-required";

/**
 * The script's editor from the Share Document portal, in an iframe, so scripts look and behave the same in both portals.
 * It arrives signed in as this person (a short-lived token in the address, kept fresh by messages); only messages from that
 * window and that origin are listened to, and they only make this page read the script's state again.
 */
export default function SharedEditorFrame({
  docId,
  readOnly = false,
  notes = [],
  activeNoteId = null,
  goToNote = null,
  focusRequest,
  lazy = false,
  toolbarExtra,
  onSelectionChange,
  onSelectNote,
}: {
  docId: string;
  readOnly?: boolean;
  notes?: DocNote[];
  activeNoteId?: string | null;
  goToNote?: { id: string; seq: number } | null;
  focusRequest?: ScriptFocusRequest;
  lazy?: boolean;
  toolbarExtra?: React.ReactNode;
  onSelectionChange?: (sel: { quote: string; start: number } | null) => void;
  onSelectNote?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameKey, setFrameKey] = useState(0);
  const needsReload = useRef(false);
  const lastTokenAt = useRef(0);

  const {
    data: session,
    dataUpdatedAt,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["script-doc-editor", docId],
    queryFn: () => scriptDocService.sharedEditor(docId),
    refetchInterval: (query) => {
      const expiresIn = query.state.data?.expires_in;
      return expiresIn ? Math.max(30_000, expiresIn * 1000 * 0.65) : FALLBACK_REFRESH_MS;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!session) return;
    lastTokenAt.current = dataUpdatedAt || Date.now();
    if (needsReload.current) {
      needsReload.current = false;
      setFrameKey((k) => k + 1);
    }
  }, [session, dataUpdatedAt]);

  // If the tab slept past the token's lifetime, a postMessage won't rescue a frame that already redirected to /login: reload it.
  useEffect(() => {
    const checkExpiry = () => {
      if (document.visibilityState === "hidden" || !session) return;
      const expiresMs = (session.expires_in ?? 15 * 60) * 1000;
      if (Date.now() - lastTokenAt.current >= Math.max(0, expiresMs - EXPIRY_BUFFER_MS)) {
        needsReload.current = true;
        void refetch();
      }
    };
    document.addEventListener("visibilitychange", checkExpiry);
    window.addEventListener("focus", checkExpiry);
    return () => {
      document.removeEventListener("visibilitychange", checkExpiry);
      window.removeEventListener("focus", checkExpiry);
    };
  }, [session, refetch]);

  const [initialReadOnly] = useState(readOnly);
  // The frame is loaded once per script (or after an expired session): readOnly switches via postMessage without reloading the iframe.
  const src = useMemo(() => {
    if (!session) return null;
    const parent = encodeURIComponent(window.location.origin);
    return `${session.url}?mode=editor${initialReadOnly ? "&readonly=1" : ""}&parent=${parent}#token=${session.token}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.share_document_id, session?.url, frameKey]);

  // Until the editor's page has loaded the frame is a blank page of this portal's own origin, which a message meant for the
  // editor's origin can't be sent to. The first token is already in the address, so only refreshes after load are sent.
  const loaded = useRef(false);
  useEffect(() => {
    loaded.current = false;
  }, [src]);

  useEffect(() => {
    if (session && loaded.current && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "script-embed:token", token: session.token }, session.origin);
    }
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== session.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; quote?: string; start?: number; id?: string; requestId?: number; found?: boolean } | null;
      const type = data?.type ?? "";
      if (type === AUTH_REQUIRED) {
        void refetch();
        return;
      }
      if (type === "script-embed:ready" && frame.current?.contentWindow) {
        frame.current.contentWindow.postMessage({ type: "script-embed:set-readonly", readOnly }, session.origin);
        frame.current.contentWindow.postMessage({ type: "script-embed:notes", notes, activeNoteId }, session.origin);
        if (goToNote) frame.current.contentWindow.postMessage({ type: "script-embed:go-to-note", id: goToNote.id }, session.origin);
        if (focusRequest) frame.current.contentWindow.postMessage({ type: "script-embed:focus-passage", ...focusRequest }, session.origin);
        return;
      }
      if (type === "script-embed:focus-result" && data?.requestId === focusRequest?.requestId) {
        if (data?.found === false) toast.info("No matching passage in the current script. The flag may describe missing content or wording that has changed.");
        return;
      }
      if (type === "script-embed:selection" && typeof data?.quote === "string") {
        onSelectionChange?.({ quote: data.quote, start: Number(data.start ?? 0) });
        return;
      }
      if (type === "script-embed:select-note" && typeof data?.id === "string") {
        onSelectNote?.(data.id);
        return;
      }
      if (!NEWS.has(type)) return;
      // This portal learns of the change through the event bus a moment after the editor does: ask again once it has.
      qc.invalidateQueries({ queryKey: ["script-doc", docId] });
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ["script-doc", docId] }), 1500);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session?.origin, qc, docId, refetch, readOnly, notes, activeNoteId, goToNote, focusRequest, onSelectionChange, onSelectNote]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusRequest && session && loaded.current && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "script-embed:focus-passage", ...focusRequest }, session.origin);
    }
  }, [focusRequest, session]);

  useEffect(() => {
    if (session && loaded.current && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "script-embed:set-readonly", readOnly }, session.origin);
      frame.current.contentWindow.postMessage({ type: "script-embed:notes", notes, activeNoteId }, session.origin);
    }
  }, [readOnly, session, notes, activeNoteId]);

  useEffect(() => {
    if (goToNote && session && loaded.current && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "script-embed:go-to-note", id: goToNote.id }, session.origin);
    }
  }, [goToNote, session]);

  const reconnect = () => {
    needsReload.current = true;
    void refetch();
  };

  const handleLoad = () => {
    loaded.current = true;
    const bootToken = src?.split("#token=")[1];
    if (session && frame.current?.contentWindow && session.token !== bootToken) {
      frame.current.contentWindow.postMessage({ type: "script-embed:token", token: session.token }, session.origin);
    }
    if (session && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({ type: "script-embed:notes", notes, activeNoteId }, session.origin);
    }
  };

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-destructive">
        <span>{(error as Error).message || "The editor couldn't be opened."}</span>
        <Button size="sm" variant="outline" onClick={reconnect} disabled={isFetching}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Reconnect editor
        </Button>
      </div>
    );
  }
  if (!src) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Opening the script editor…
      </div>
    );
  }
  return (
    <div className="flex min-h-[24rem] flex-1 flex-col">
      {readOnly && toolbarExtra && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Read-only · select wording in the document to highlight &amp; comment.</span>
          <span className="ml-auto flex items-center gap-1">{toolbarExtra}</span>
        </div>
      )}
      <iframe
        key={frameKey}
        ref={frame}
        src={src}
        onLoad={handleLoad}
        title="Script editor"
        loading={lazy ? "lazy" : "eager"}
        className="min-h-[24rem] w-full flex-1 border-0"
        allow="clipboard-read; clipboard-write"
      />
      <div className="flex items-center justify-end border-t bg-muted/20 px-2 py-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground"
          onClick={reconnect}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Reconnect editor
        </Button>
      </div>
    </div>
  );
}
