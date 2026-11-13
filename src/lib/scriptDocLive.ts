import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";

import { BASE_URL } from "@/services/apiClient";
import type { DocLiveState } from "@/types/scriptDoc";

export type LiveStatus = "connecting" | "live" | "offline";

const b64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface LiveHandlers {
  /** The connection is open and the document rebuilt; `seed` means this browser gives the editor its starting text. */
  onReady: (info: { seed: boolean; canEdit: boolean; canNote: boolean }) => void;
  /** This browser was given the starting text after asking for it. */
  onSeed: () => void;
  onState: (state: DocLiveState) => void;
  /** Someone else changed the text ("text") or the notes ("notes"). */
  onRemoteChange: (userId: string, channel: "text" | "notes") => void;
  onStatus: (status: LiveStatus) => void;
}

/**
 * The browser's side of a script's live editing connection: two shared documents (the script's text, and its notes),
 * and the cursors and names of everyone who has it open. Every local change is sent; every change from others is applied.
 * Reconnects by itself, rebuilding from the stored updates (applying one twice does nothing).
 */
export class LiveProvider {
  readonly doc = new Y.Doc();
  readonly notes = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seedTimer: ReturnType<typeof setInterval> | null = null;
  canEdit = false;
  canNote = false;
  userId = "";
  userName = "";

  private docId: string;
  private handlers: LiveHandlers;

  constructor(docId: string, handlers: LiveHandlers) {
    this.docId = docId;
    this.handlers = handlers;
    this.doc.on("update", (u: Uint8Array, origin: unknown) => {
      if (origin !== this) this.send({ type: "update", ch: "text", d: b64(u) });
    });
    this.notes.on("update", (u: Uint8Array, origin: unknown) => {
      if (origin !== this) this.send({ type: "update", ch: "notes", d: b64(u) });
    });
    this.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === this) return;
      this.send({ type: "awareness", d: b64(encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed])) });
    });
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  connect() {
    this.closed = false;
    this.handlers.onStatus("connecting");
    const base = (BASE_URL || window.location.origin).replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/api/script-docs/${this.docId}/live`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      const token = sessionStorage.getItem("token");
      if (token) ws.send(JSON.stringify({ type: "auth", token }));
    };
    ws.onmessage = (ev) => {
      let m: any;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.receive(m);
    };
    ws.onclose = () => {
      this.handlers.onStatus("offline");
      // Others' cursors are gone with the connection.
      const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
      if (others.length) removeAwarenessStates(this.awareness, others, this);
      if (this.closed) return;
      this.timer = setTimeout(() => this.connect(), Math.min(10_000, 500 * 2 ** this.retry++));
    };
  }

  private receive(m: any) {
    switch (m.type) {
      case "init": {
        this.userId = m.user.id;
        this.userName = m.user.name;
        this.canEdit = m.you.can_edit;
        this.canNote = m.you.can_note;
        Y.transact(this.doc, () => (m.updates.text as string[]).forEach((u) => Y.applyUpdate(this.doc, unb64(u), this)), this);
        Y.transact(this.notes, () => (m.updates.notes as string[]).forEach((u) => Y.applyUpdate(this.notes, unb64(u), this)), this);
        // Say where our cursor is, now that others can see it.
        const local = this.awareness.getLocalState();
        if (local) this.awareness.setLocalState({ ...local });
        this.handlers.onStatus("live");
        this.handlers.onReady({ seed: m.seed, canEdit: this.canEdit, canNote: this.canNote });
        // An empty script nobody has given its starting text yet: keep asking until someone has.
        this.stopSeedAsk();
        if (!m.seed && (m.updates.text as string[]).length === 0) {
          this.seedTimer = setInterval(() => this.send({ type: "claim_seed" }), 1500);
        }
        break;
      }
      case "update": {
        if (m.ch === "text") this.stopSeedAsk();
        const target = m.ch === "notes" ? this.notes : this.doc;
        Y.applyUpdate(target, unb64(m.d), this);
        this.handlers.onRemoteChange(m.from, m.ch);
        break;
      }
      case "seed":
        this.stopSeedAsk();
        this.handlers.onSeed();
        break;
      case "awareness":
        applyAwarenessUpdate(this.awareness, unb64(m.d), this);
        break;
      case "left": {
        const gone = [...this.awareness.getStates().entries()].filter(([, s]) => (s as any)?.user?.id === m.user_id).map(([id]) => id);
        if (gone.length) removeAwarenessStates(this.awareness, gone, this);
        break;
      }
      case "state":
        if (m.you) {
          this.canEdit = m.you.can_edit;
          this.canNote = m.you.can_note;
        }
        this.handlers.onState(m as DocLiveState);
        break;
    }
  }

  private stopSeedAsk() {
    if (this.seedTimer) clearInterval(this.seedTimer);
    this.seedTimer = null;
  }

  destroy() {
    this.closed = true;
    this.stopSeedAsk();
    if (this.timer) clearTimeout(this.timer);
    this.awareness.destroy();
    this.ws?.close();
    this.doc.destroy();
    this.notes.destroy();
  }
}
