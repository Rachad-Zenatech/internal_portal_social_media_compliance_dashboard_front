import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { scriptDocService } from "@/services/scriptDocService";

// The sign-in the server hands out lasts 15 minutes; a fresh one is sent to the editor well before then.
const TOKEN_REFRESH_MS = 10 * 60 * 1000;

/** Messages the shared editor sends this page (see the Share Document front's lib/embedBridge.ts). */
const NEWS = new Set(["script-embed:status", "script-embed:merge-completed", "script-embed:post-requested"]);

/**
 * The script's editor from the Share Document portal, in an iframe, so scripts look and behave the same in both portals.
 * It arrives signed in as this person (a short-lived token in the address, kept fresh by messages); only messages from that
 * window and that origin are listened to, and they only make this page read the script's state again.
 */
export default function SharedEditorFrame({ docId }: { docId: string }) {
  const qc = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const { data: session, error } = useQuery({
    queryKey: ["script-doc-editor", docId],
    queryFn: () => scriptDocService.sharedEditor(docId),
    refetchInterval: TOKEN_REFRESH_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // The frame is loaded once per script: a refreshed token is sent to it, never by reloading it.
  const src = useMemo(() => {
    if (!session) return null;
    const parent = encodeURIComponent(window.location.origin);
    return `${session.url}?mode=editor&parent=${parent}#token=${session.token}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.share_document_id]);

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
      if (!NEWS.has((e.data as { type?: string } | null)?.type ?? "")) return;
      // This portal learns of the change through the event bus a moment after the editor does: ask again once it has.
      qc.invalidateQueries({ queryKey: ["script-doc", docId] });
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ["script-doc", docId] }), 1500);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [session?.origin, qc, docId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">{(error as Error).message || "The editor couldn't be opened."}</div>;
  }
  if (!src) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Opening the script editor…
      </div>
    );
  }
  return <iframe ref={frame} src={src} onLoad={() => { loaded.current = true; }} title="Script editor" className="min-h-[24rem] w-full flex-1 border-0" allow="clipboard-read; clipboard-write" />;
}
