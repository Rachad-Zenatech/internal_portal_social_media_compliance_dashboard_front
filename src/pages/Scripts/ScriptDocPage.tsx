import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { type CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import DocDetailsDialog from "@/components/scriptdoc/DocDetailsPanel";
import DocDialogs, { type DialogName } from "@/components/scriptdoc/DocDialogs";
import DocEditorColumn from "@/components/scriptdoc/DocEditorColumn";
import EditorLayoutBar from "@/components/scriptdoc/EditorLayoutBar";
import DocHeader, { DocStatusStrip } from "@/components/scriptdoc/DocHeader";
import DocSidePanel, { type PanelTab } from "@/components/scriptdoc/DocSidePanel";
import PagesRail from "@/components/scriptdoc/PagesRail";
import { LiveProvider, type LiveStatus } from "@/lib/scriptDocLive";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocDetail, DocNote, Vote } from "@/types/scriptDoc";

const errText = (e: unknown) => (e as { message?: string })?.message ?? "Something went wrong";
const SNAPSHOT_DELAY_MS = 2500;
const IDLE_BEFORE_ASKING_MS = 10_000;

/** The notes document as a list, kept up to date as anyone changes it. */
function useNotes(provider: LiveProvider | null) {
  const [notes, setNotes] = useState<DocNote[]>([]);
  useEffect(() => {
    if (!provider) return;
    const map = provider.notes.getMap<DocNote>("notes");
    const read = () => setNotes([...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    read();
    map.observe(read);
    return () => map.unobserve(read);
  }, [provider]);
  return notes;
}

/**
 * A script open for review. The page is the shared script (everyone edits at once, with their own colour and name on their
 * cursor); the right panel holds the notes, the rulebook flags, the review's check-ins and the history.
 */
export default function ScriptDocPage() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const editor = useRef<CollabEditorHandle>(null);

  const { data: doc, isLoading, error } = useQuery({ queryKey: ["script-doc", id], queryFn: () => scriptDocService.get(id), refetchOnWindowFocus: false });
  const setDoc = useCallback((d: DocDetail) => qc.setQueryData(["script-doc", id], d), [qc, id]);

  // The live connection.
  const [provider, setProvider] = useState<LiveProvider | null>(null);
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState(false);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [online, setOnline] = useState<{ id: string; name: string; color: string }[]>([]);
  const [changedBy, setChangedBy] = useState<string | null>(null);
  const docRef = useRef<DocDetail | null>(null);
  useEffect(() => {
    docRef.current = doc ?? null;
  }, [doc]);

  useEffect(() => {
    if (!id || !doc?.title) return;
    document.dispatchEvent(
      new CustomEvent("set-breadcrumb-title", { detail: { path: `/script-docs/${id}`, title: doc.title } })
    );
  }, [id, doc?.title]);
  const askTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpenState] = useState<Record<DialogName, boolean>>({ submit: false, bulk: false, checkIn: false, level2: false, decide: false });
  const setOpen = useCallback((name: DialogName, value: boolean) => setOpenState((o) => ({ ...o, [name]: value })), []);
  const level2Dismissed = useRef(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A script written in the Share Document portal keeps its text there: this portal's connection then carries only the notes
  // (highlights and comments). The writer sees that portal's editor; reviewers a read-only copy of the text to mark up.
  const live = Boolean(doc);
  const shared = Boolean(doc?.share_document_id);
  const writerSide = shared && doc?.access.role === "CREATOR";
  // The writer edits in the Share Document portal's editor, or looks at the reviewers' highlights on a read-only copy.
  const [writerView, setWriterView] = useState<"edit" | "marks">("edit");
  const inEditor = writerSide && writerView === "edit";
  useEffect(() => {
    if (!live) return;
    const p = new LiveProvider(id, {
      onReady: ({ seed: s }) => {
        setSeed(s);
        setReady(true);
      },
      onStatus: setStatus,
      onSeed: () => setSeed(true),
      onState: (s) => {
        if (!s.all_checked) level2Dismissed.current = false;
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => qc.invalidateQueries({ queryKey: ["script-doc", id] }), 300);
      },
      onRemoteChange: (userId) => {
        const d = docRef.current;
        if (!d || d.status !== "IN_REVIEW" || !d.access.can_check_in) return;
        const who = d.reviewers.find((r) => r.user_id === userId)?.name ?? (userId === d.creator_id ? d.creator_name : null) ?? "Another reviewer";
        setChangedBy(who);
        // When they've stopped changing things for a while, ask each reviewer whether they've finished.
        if (askTimer.current) clearTimeout(askTimer.current);
        askTimer.current = setTimeout(() => {
          const cur = docRef.current;
          if (cur && cur.access.can_check_in) setOpen("checkIn", true);
        }, IDLE_BEFORE_ASKING_MS);
      },
    }, { notesOnly: shared });
    setProvider(p);
    setReady(false);
    p.connect();
    return () => {
      if (askTimer.current) clearTimeout(askTimer.current);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      p.destroy();
      setProvider(null);
    };
  }, [id, live, shared, qc, setOpen]);

  // Who has the script open right now (from the cursors).
  useEffect(() => {
    if (!provider) return;
    const read = () => {
      const seen = new Map<string, { id: string; name: string; color: string }>();
      provider.awareness.getStates().forEach((s) => {
        const u = (s as { user?: { id: string; name: string; color: string } }).user;
        if (u?.id) seen.set(u.id, u);
      });
      setOnline([...seen.values()]);
    };
    // The editor sets its own cursor while it is being created (during another component's render), so the update is
    // deferred rather than made from inside that render.
    const later = () => queueMicrotask(read);
    provider.awareness.on("change", later);
    read();
    return () => provider.awareness.off("change", later);
  }, [provider]);

  const notes = useNotes(provider);
  const [tab, setTab] = useState<PanelTab>("notes");
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ quote: string; start: number } | null>(null);

  const status_ = doc?.status;
  // Reviewers asked again after the script changed; the Level 2 question once everyone has checked in.
  useEffect(() => {
    if (!doc) return;
    if (doc.all_checked && doc.access.can_finalize && doc.status === "IN_REVIEW" && !level2Dismissed.current) {
      setOpen("checkIn", false);
      setOpen("level2", true);
    }
    if (doc.status !== "IN_REVIEW") {
      setOpen("level2", false);
      setOpen("checkIn", false);
    }
  }, [doc, status_, setOpen]);

  // Save the script as it reads (for lists, flags and history) a moment after someone stops typing.
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canEdit = Boolean(doc?.access.can_edit) && !shared; // a shared script is saved from its own editor
  const onEdited = useCallback(() => {
    if (!canEdit) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const h = editor.current;
      if (h) void scriptDocService.snapshot(id, h.getHtml(), h.getText()).catch(() => undefined);
    }, SNAPSHOT_DELAY_MS);
  }, [canEdit, id]);
  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);

  // Notes live in the shared notes document.
  const me = provider?.userId ?? "";
  const myName = provider?.userName || "Someone";
  const myColor = doc?.my_color ?? "#2563eb";
  const putNote = (n: DocNote) => provider?.notes.getMap<DocNote>("notes").set(n.id, n);
  const addNote = (kind: "highlight" | "comment", text: string, sel: { quote: string; start: number }) => {
    putNote({
      id: crypto.randomUUID(), kind, quote: sel.quote, start: sel.start, text, color: myColor, author_id: me, author_name: myName,
      created_at: new Date().toISOString(), resolved: false, replies: [],
    });
    setTab("notes");
  };
  const startNote = (kind: "highlight" | "comment") => {
    const sel = editor.current?.selection();
    if (!sel) {
      toast.info("Select some wording inside one paragraph or cell first.");
      return;
    }
    if (kind === "highlight") addNote("highlight", "", sel);
    else {
      setComposer(sel);
      setTab("notes");
    }
  };
  const mutateNote = (nid: string, fn: (n: DocNote) => DocNote) => {
    const map = provider?.notes.getMap<DocNote>("notes");
    const cur = map?.get(nid);
    if (map && cur) map.set(nid, fn(cur));
  };

  // The creator's pages: every script is its own page with its own review.
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);
  // The pages list and the review panel can be hidden to give the editor the room (the choice is kept for next time).
  const [showPages, setShowPages] = useState(() => localStorage.getItem("script-doc-pages") !== "off");
  const [showPanel, setShowPanel] = useState(() => localStorage.getItem("script-doc-panel") !== "off");
  const toggle = (key: string, set: (v: boolean) => void, now: boolean) => {
    set(!now);
    localStorage.setItem(key, now ? "off" : "on");
  };
  const [pageBusy, setPageBusy] = useState(false);
  /** Keep what is on screen: the page being edited is saved before leaving it or sending. */
  const flush = async () => {
    const h = editor.current;
    if (h && doc?.access.can_edit && !shared) await scriptDocService.snapshot(id, h.getHtml(), h.getText()).catch(() => undefined);
  };
  const addPage = async () => {
    setPageBusy(true);
    try {
      await flush();
      const page = await scriptDocService.addPage(id);
      qc.invalidateQueries({ queryKey: ["script-docs"] });
      navigate(`/script-docs/${page.id}`);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setPageBusy(false);
    }
  };
  /** Delete a draft page, then go to the page beside it (or back to the hub when it was the last). */
  const deletePage = async (page: { id: string }) => {
    await scriptDocService.remove(page.id);
    qc.invalidateQueries({ queryKey: ["script-docs"] });
    toast.success("Script deleted");
    const rest = (doc?.pages ?? []).filter((p) => p.id !== page.id);
    if (page.id !== id) qc.invalidateQueries({ queryKey: ["script-doc", id] });
    else navigate(rest[0] ? `/script-docs/${rest[0].id}` : "/script-review");
  };
  const sendAll = async (reviewers: { user_id: string; capacity: "EDIT" | "VIEW" }[], note: string) => {
    setPageBusy(true);
    try {
      await flush();
      const r = await scriptDocService.submitPages(id, { reviewers, note });
      if (r.sent) toast.success(`${r.sent} script${r.sent === 1 ? "" : "s"} sent for review`);
      r.failed.forEach((f) => toast.error(`${f.title}: ${f.reason}`));
      setOpen("bulk", false);
      qc.invalidateQueries({ queryKey: ["script-doc", id] });
      qc.invalidateQueries({ queryKey: ["script-docs"] });
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setPageBusy(false);
    }
  };

  const run = useMutation({
    mutationFn: (fn: () => Promise<DocDetail>) => fn(),
    onSuccess: (d) => setDoc(d),
    onError: (e) => toast.error(errText(e)),
  });

  const presence = useMemo(() => online.filter((u) => u.id !== me), [online, me]);
  const onlineIds = useMemo(() => new Set(online.map((u) => u.id)), [online]);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Opening the script…</div>;
  if (error || !doc) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{errText(error) || "This script can't be opened."}</p>
        <Link to="/script-review" className="text-sm underline">Back to scripts</Link>
      </div>
    );
  }

  const myCheckIn: Vote | null = doc.reviewers.find((r) => r.user_id === me)?.vote ?? null;
  const user = { id: me, name: myName, color: myColor };

  // Sending is off until the details for the posts are filled in.
  const sendHint = doc.missing_details.length > 0 ? `Fill in the details first: ${doc.missing_details.join(", ")}` : undefined;
  const onOpen = (name: DialogName, value: boolean) => {
    setOpen(name, value);
    if (name === "level2" && !value) level2Dismissed.current = true;
  };
  const handlers = {
    submit: (reviewers: { user_id: string; capacity: "EDIT" | "VIEW" }[], note: string) =>
      run.mutate(
        () => scriptDocService.submit(id, { reviewers, note, html: editor.current?.getHtml(), text: editor.current?.getText() }),
        { onSuccess: () => { setOpen("submit", false); toast.success("Sent for review"); } },
      ),
    sendAll,
    checkIn: (vote: Vote, note: string) =>
      run.mutate(() => scriptDocService.checkIn(id, { vote, note }), { onSuccess: () => { setOpen("checkIn", false); setChangedBy(null); } }),
    finalize: (route: "LEVEL2" | "CREATOR", note: string) =>
      run.mutate(() => scriptDocService.finalize(id, route, note), { onSuccess: () => setOpen("level2", false) }),
    decide: (decision: "APPROVE" | "SEND_BACK", note: string) =>
      run.mutate(() => scriptDocService.decide(id, decision, note), { onSuccess: () => setOpen("decide", false) }),
  };
  const actions = {
    onDetails: () => setDetailsOpen(true),
    onSend: () => setOpen("submit", true),
    onFinish: () => setOpen("checkIn", true),
    onUndoCheckIn: () => run.mutate(() => scriptDocService.withdrawCheckIn(id)),
    onDecideNext: () => { level2Dismissed.current = false; setOpen("level2", true); },
    onDecision: () => setOpen("decide", true),
  };

  return (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[34rem] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
      <DocHeader doc={doc} live={status} people={presence} myCheckIn={myCheckIn} sendHint={sendHint} actions={actions} />
      <DocStatusStrip doc={doc} myCheckIn={myCheckIn} changedBy={changedBy} />
      <DocDetailsDialog key={doc.id} doc={doc} open={detailsOpen} onOpenChange={setDetailsOpen} onDoc={setDoc} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {doc.pages.length > 0 && showPages && (
          <PagesRail doc={doc} busy={pageBusy} onAdd={addPage} sendDisabledReason={sendHint} onSendAll={() => setOpen("bulk", true)} onDeletePage={deletePage} />
        )}
        <DocEditorColumn
          provider={provider}
          ready={ready}
          editorRef={editor}
          user={user}
          editable={doc.access.can_edit}
          canNote={doc.access.can_note}
          seedHtml={seed ? doc.body_html : null}
          notes={notes}
          activeNoteId={activeNote}
          onChange={onEdited}
          onSelectNote={(nid) => { setActiveNote(nid); setTab("notes"); }}
          onStartNote={startNote}
          sharedDocId={inEditor ? id : null}
          mirrorHtml={shared && !inEditor ? doc.body_html : null}
          bar={
            <EditorLayoutBar
              position={Math.max(1, doc.pages.findIndex((p) => p.id === id) + 1)}
              total={doc.pages.length}
              showPages={showPages}
              showPanel={showPanel}
              onTogglePages={() => toggle("script-doc-pages", setShowPages, showPages)}
              onTogglePanel={() => toggle("script-doc-panel", setShowPanel, showPanel)}
              view={writerSide ? writerView : undefined}
              onView={writerSide ? setWriterView : undefined}
            />
          }
        />
        {(showPanel || !writerSide) && <DocSidePanel
          doc={doc}
          tab={tab}
          onTab={setTab}
          notes={notes}
          online={onlineIds}
          editor={editor}
          me={me}
          activeId={activeNote}
          composer={composer}
          onPick={(n) => { setActiveNote(n.id); editor.current?.goTo(n); }}
          onReply={(nid, text) => mutateNote(nid, (n) => ({ ...n, replies: [...n.replies, { author_name: myName, text, created_at: new Date().toISOString() }] }))}
          onResolve={(nid, resolved) => mutateNote(nid, (n) => ({ ...n, resolved }))}
          onDelete={(nid) => provider?.notes.getMap<DocNote>("notes").delete(nid)}
          onCompose={(text) => { if (composer) addNote("comment", text, composer); setComposer(null); }}
          onCancelCompose={() => setComposer(null)}
        />}
      </div>

      <DocDialogs doc={doc} open={open} onOpen={onOpen} busy={run.isPending || pageBusy} changedBy={changedBy} handlers={handlers} />
    </div>
  );
}
