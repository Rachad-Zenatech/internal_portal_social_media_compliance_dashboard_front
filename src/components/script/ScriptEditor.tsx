import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { EditorContent, Node, mergeAttributes, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ListItem from "@tiptap/extension-list-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Bold,
  Columns3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Rows3,
  SeparatorHorizontal,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";

import { docToText, textToDoc } from "@/lib/scriptDoc";

/** A page break, drawn as a labelled divider (the page number is counted in CSS). */
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "", class: "script-page-break" })],
});

/** A list item holds one paragraph, so a list is always one line per item. */
const FlatListItem = ListItem.extend({ content: "paragraph" });

export const SCRIPT_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    listItem: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    strike: false,
    horizontalRule: false,
  }),
  FlatListItem,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  PageBreak,
];

export interface ScriptEditorHandle {
  /** Select the first place this wording appears and scroll to it. */
  find: (term: string) => boolean;
  focus: () => void;
}

/** Select and scroll to the first text node containing the wording. */
function findAndSelect(editor: Editor, term: string): boolean {
  const needle = term.toLowerCase();
  let found: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return !found;
    const at = node.text.toLowerCase().indexOf(needle);
    if (at >= 0) found = { from: pos + at, to: pos + at + term.length };
    return !found;
  });
  if (!found) return false;
  editor.chain().focus().setTextSelection(found).scrollIntoView().run();
  return true;
}

function Tool({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // The editor keeps its selection while a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
        active ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200" : "text-foreground/80 hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

function Toolbar({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");
  const level = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));
  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-12 z-10 flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-xs backdrop-blur">
      <Tool label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="w-4 h-4" />
      </Tool>
      <Tool label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="w-4 h-4" />
      </Tool>
      <Divider />
      <select
        aria-label="Text style"
        value={level ? `h${level}` : "p"}
        onChange={(e) => {
          const v = e.target.value;
          const chain = editor.chain().focus();
          if (v === "p") chain.setParagraph().run();
          else chain.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground"
      >
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <Tool label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-4 h-4" />
      </Tool>
      <Tool label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-4 h-4" />
      </Tool>
      <Divider />
      <Tool label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-4 h-4" />
      </Tool>
      <Tool label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="w-4 h-4" />
      </Tool>
      <Divider />
      <Tool
        label="Insert a table"
        disabled={inTable}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table2 className="w-4 h-4" />
      </Tool>
      <Tool label="Page break" onClick={() => editor.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run()}>
        <SeparatorHorizontal className="w-4 h-4" />
      </Tool>
      {inTable && (
        <>
          <Divider />
          <Tool label="Add a row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Rows3 className="w-4 h-4" /> Row
          </Tool>
          <Tool label="Add a column to the right" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <Columns3 className="w-4 h-4" /> Column
          </Tool>
          <Tool label="Delete this row" onClick={() => editor.chain().focus().deleteRow().run()}>
            <Trash2 className="w-3.5 h-3.5" /> Row
          </Tool>
          <Tool label="Delete this column" onClick={() => editor.chain().focus().deleteColumn().run()}>
            <Trash2 className="w-3.5 h-3.5" /> Column
          </Tool>
          <Tool label="Delete the table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 className="w-3.5 h-3.5" /> Table
          </Tool>
        </>
      )}
    </div>
  );
}

/**
 * A script as a document, edited like in Word or Google Docs: a toolbar, headings, bold and italic, lists, tables and
 * page breaks. The script is still kept as text (see lib/scriptDoc), so `value` and `onChange` are that text and the
 * check, the comparison and the review work as before.
 */
export default function ScriptEditor({
  value,
  onChange,
  ref,
  className = "",
}: {
  value: string;
  onChange: (text: string) => void;
  ref?: Ref<ScriptEditorHandle>;
  className?: string;
}) {
  // The text this editor last handed out: a `value` equal to it is the editor's own change coming back, not a new one.
  const emitted = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: SCRIPT_EXTENSIONS,
    content: textToDoc(value),
    editorProps: {
      attributes: { class: "script-doc focus:outline-none", spellcheck: "true", "aria-label": "Script", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: e }) => {
      const text = docToText(e.getJSON());
      emitted.current = text;
      onChangeRef.current(text);
    },
  });

  // Changed from outside (undo my changes, a suggested revision, an added disclaimer): show the new text.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(textToDoc(value), false);
  }, [editor, value]);

  useImperativeHandle(ref, () => ({ find: (term) => (editor ? findAndSelect(editor, term) : false), focus: () => editor?.commands.focus() }), [editor]);

  if (!editor) return null;
  return (
    <div className={`script-editor flex flex-col gap-2 ${className}`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
