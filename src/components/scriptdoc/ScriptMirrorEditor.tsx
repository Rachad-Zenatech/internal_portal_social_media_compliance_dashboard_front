import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useState, type Ref } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ListItem from "@tiptap/extension-list-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import { LatestProps, NoteMarks, findAndSelect, locate, notesKey } from "@/components/scriptdoc/scriptNoteMarks";
import type { DocNote } from "@/types/scriptDoc";

const FlatListItem = ListItem.extend({ content: "paragraph" });

interface Props {
  /** The script as the writer has it now (this portal keeps it in step with the Share Document editor). */
  html: string;
  notes: DocNote[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  /** Extra buttons for the toolbar (highlight, comment). */
  toolbarExtra?: React.ReactNode;
}

/**
 * A reviewer's page of a script that is written in the Share Document portal: a read-only copy of the text, with every
 * highlight and comment drawn on the wording it belongs to, and wording to select for a new one. The reviewers' notes are
 * kept in this portal (the notes connection); the text is never edited here, so it stays the writer's.
 */
const ScriptMirrorEditor = forwardRef(function ScriptMirrorEditor(
  { html, notes, activeNoteId, onSelectNote, toolbarExtra }: Props,
  ref: Ref<CollabEditorHandle>,
) {
  const [latest] = useState(() => new LatestProps(notes, activeNoteId, () => {}));
  useLayoutEffect(() => latest.set(notes, activeNoteId, () => {}), [latest, notes, activeNoteId]);

  const editor = useEditor({
    editable: false,
    content: html,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, listItem: false, blockquote: false, codeBlock: false, code: false, strike: false, horizontalRule: false }),
      FlatListItem,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      NoteMarks.configure({ getNotes: () => latest.notes, getActive: () => latest.active }),
    ],
    editorProps: {
      attributes: { class: "script-doc-page focus:outline-none", spellcheck: "false" },
      handleClick: (_view, _pos, event) => {
        const el = (event.target as HTMLElement | null)?.closest?.("[data-note]") as HTMLElement | null;
        if (el?.dataset.note) onSelectNote(el.dataset.note);
        return false;
      },
    },
  });

  // The writer changed the script: show it, and draw the notes on it again.
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.getHTML() === html) return;
    editor.commands.setContent(html, false);
  }, [editor, html]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(notesKey, true));
  }, [editor, notes, activeNoteId]);

  useImperativeHandle(
    ref,
    () => ({
      find: (term) => (editor ? findAndSelect(editor, term) : false),
      replace: () => false,
      getHtml: () => editor?.getHTML() ?? "",
      append: () => {},
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
    [editor],
  );

  if (!editor) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-3 py-1.5 backdrop-blur">
        <span className="text-xs text-muted-foreground">Select wording to highlight it or leave a comment. The writer makes the changes.</span>
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

export default ScriptMirrorEditor;
