import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ListItem from "@tiptap/extension-list-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { ySyncPluginKey } from "y-prosemirror";
import { Bold, Columns3, Italic, List, ListOrdered, Redo2, Rows3, Trash2, Undo2 } from "lucide-react";

import type { LiveProvider } from "@/lib/scriptDocLive";
import type { DocNote } from "@/types/scriptDoc";
import { LatestProps, NoteMarks, findAndSelect, locate, notesKey } from "@/components/scriptdoc/scriptNoteMarks";

const FlatListItem = ListItem.extend({ content: "paragraph" });

export interface CollabEditorHandle {
  find: (term: string) => boolean;
  /** Put the rewrite in place of the quoted wording; false when that wording isn't in the script any more. */
  replace: (quote: string, rewrite: string) => boolean;
  getHtml: () => string;
  /** Add content (another script) at the end of the page. */
  append: (html: string) => void;
  getText: () => string;
  /** The wording selected (inside one paragraph or cell) and where it starts, for a highlight or comment. */
  selection: () => { quote: string; start: number } | null;
  /** Select a note's wording and scroll to it. */
  goTo: (note: DocNote) => boolean;
}

function Tool({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-xs transition-colors disabled:opacity-40 ${
        active ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200" : "text-foreground/80 hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

interface Props {
  provider: LiveProvider;
  user: { id: string; name: string; color: string };
  editable: boolean;
  /** Set when this browser gives the editor its starting text. */
  seedHtml: string | null;
  notes: DocNote[];
  activeNoteId: string | null;
  onChange: () => void;
  onSelectNote: (id: string) => void;
  /** Extra buttons for the toolbar (highlight, comment). */
  toolbarExtra?: React.ReactNode;
}

/**
 * The script as a shared page: everyone with it open edits the same text, and sees each other's cursor with their name
 * above it in their own colour. Someone who can't edit reads it live and can still select wording to highlight or comment on.
 */
const CollabEditor = forwardRef(function CollabEditor(
  { provider, user, editable, seedHtml, notes, activeNoteId, onChange, onSelectNote, toolbarExtra }: Props,
  ref: Ref<CollabEditorHandle>,
) {
  // What the editor's plugins read when they draw: always the latest notes, without rebuilding the editor.
  const [live] = useState(() => new LatestProps(notes, activeNoteId, onChange));
  useLayoutEffect(() => live.set(notes, activeNoteId, onChange), [live, notes, activeNoteId, onChange]);

  const editor = useEditor(
    {
      editable,
      extensions: [
        StarterKit.configure({ history: false, heading: { levels: [1, 2, 3] }, listItem: false, blockquote: false, codeBlock: false, code: false, strike: false, horizontalRule: false }),
        FlatListItem,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Collaboration.configure({ document: provider.doc, field: "default" }),
        CollaborationCursor.configure({ provider, user }),
        NoteMarks.configure({ getNotes: () => live.notes, getActive: () => live.active }),
      ],
      editorProps: {
        attributes: { class: "script-doc-page focus:outline-none", spellcheck: "true" },
        handleClick: (_view, _pos, event) => {
          const el = (event.target as HTMLElement | null)?.closest?.("[data-note]") as HTMLElement | null;
          if (el?.dataset.note) onSelectNote(el.dataset.note);
          return false;
        },
      },
      onUpdate: () => live.change(),
    },
    [provider],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // The first person to open a new script gives the shared page its starting text. It waits until the editor is connected to
  // the shared document, and only writes into a page that still shows nothing (so two people can never both add it).
  const seeded = useRef(false);
  useEffect(() => {
    if (!editor || seedHtml == null || seeded.current) return;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    const attempt = () => {
      if (editor.isDestroyed) return;
      const connected = Boolean(ySyncPluginKey.getState(editor.state)?.binding);
      if (!connected && tries++ < 100) {
        timer = setTimeout(attempt, 25);
        return;
      }
      seeded.current = true;
      // "Empty" is what the editor shows: connecting it to an empty shared document leaves one empty paragraph in it, so
      // the shared document's own length can't be used.
      if (editor.isEmpty) {
        editor.commands.setContent(seedHtml, false);
        live.change();
      }
    };
    timer = setTimeout(attempt, 0);
    return () => clearTimeout(timer);
  }, [editor, seedHtml, live, provider]);

  // Redraw the notes when they change or one is picked.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(notesKey, true));
  }, [editor, notes, activeNoteId]);

  useImperativeHandle(
    ref,
    () => ({
      find: (term) => (editor ? findAndSelect(editor, term) : false),
      replace: (quote, rewrite) => {
        if (!editor || !editable) return false;
        const at = locate(editor.state.doc, { quote, start: 0 } as DocNote);
        if (!at) return false;
        editor.chain().focus().insertContentAt(at, rewrite).run();
        return true;
      },
      getHtml: () => editor?.getHTML() ?? "",
      append: (html) => {
        if (!editor || !editable) return;
        editor.chain().insertContentAt(editor.state.doc.content.size, html).focus("end").scrollIntoView().run();
      },
      getText: () => editor?.getText({ blockSeparator: "\n" }) ?? "",
      selection: () => {
        if (!editor) return null;
        const { from, to, empty } = editor.state.selection;
        if (empty) return null;
        const $from = editor.state.doc.resolve(from);
        const $to = editor.state.doc.resolve(to);
        if (!$from.sameParent($to)) return null;
        const quote = editor.state.doc.textBetween(from, to).trim();
        return quote ? { quote, start: from } : null;
      },
      goTo: (note) => {
        if (!editor) return false;
        const at = locate(editor.state.doc, note);
        if (!at) return false;
        editor.chain().setTextSelection(at).scrollIntoView().run();
        return true;
      },
    }),
    [editor, editable],
  );

  if (!editor) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background/95 px-2 py-1 backdrop-blur">
        <Tool label="Bold" disabled={!editable} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Tool>
        <Tool label="Italic" disabled={!editable} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Tool>
        <Tool label="Bullet list" disabled={!editable} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Tool>
        <Tool label="Numbered list" disabled={!editable} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Tool>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Tool label="Add a row below" disabled={!editable || !editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}>
          <Rows3 className="h-4 w-4" />
        </Tool>
        <Tool label="Add a column after" disabled={!editable || !editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}>
          <Columns3 className="h-4 w-4" />
        </Tool>
        <Tool label="Delete this row" disabled={!editable || !editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}>
          <Trash2 className="h-4 w-4" />
        </Tool>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Tool label="Undo (your own changes)" disabled={!editable} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </Tool>
        <Tool label="Redo" disabled={!editable} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </Tool>
        {toolbarExtra && <span className="ml-auto flex items-center gap-1">{toolbarExtra}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 sm:p-6">
        <div className="mx-auto max-w-4xl rounded-lg border bg-background p-4 shadow-sm sm:p-8">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});

export default CollabEditor;
