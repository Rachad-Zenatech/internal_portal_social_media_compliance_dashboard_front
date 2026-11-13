import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

import type { DocNote } from "@/types/scriptDoc";

/** What an editor's plugins read when they draw: always the latest notes, without rebuilding the editor. */
export class LatestProps {
  notes: DocNote[];
  active: string | null;
  change: () => void;
  constructor(notes: DocNote[], active: string | null, change: () => void) {
    this.notes = notes;
    this.active = active;
    this.change = change;
  }
  set(notes: DocNote[], active: string | null, change: () => void) {
    this.notes = notes;
    this.active = active;
    this.change = change;
  }
}

export const notesKey = new PluginKey<DecorationSet>("scriptDocNotes");

/** Where a note's wording is now: the occurrence nearest to where it started (the text moves as people edit). */
export function locate(doc: PMNode, note: DocNote): { from: number; to: number } | null {
  let best: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textContent;
    let at = text.indexOf(note.quote);
    while (at >= 0) {
      const from = pos + 1 + at;
      if (!best || Math.abs(from - note.start) < Math.abs(best.from - note.start)) best = { from, to: from + note.quote.length };
      at = text.indexOf(note.quote, at + 1);
    }
    return false;
  });
  return best;
}

interface NoteOptions {
  getNotes: () => DocNote[];
  getActive: () => string | null;
}

/** Draws every highlight and comment on the wording it belongs to, in the colour of the person who made it. */
export const NoteMarks = Extension.create<NoteOptions>({
  name: "scriptDocNotes",
  addOptions: () => ({ getNotes: () => [], getActive: () => null }),
  addProseMirrorPlugins() {
    const opts = this.options;
    const build = (doc: PMNode) => {
      const active = opts.getActive();
      const decos: Decoration[] = [];
      for (const n of opts.getNotes()) {
        if (n.resolved) continue;
        const at = locate(doc, n);
        if (!at) continue;
        const strong = n.id === active;
        decos.push(
          Decoration.inline(at.from, at.to, {
            class: `script-note script-note-${n.kind}${strong ? " script-note-active" : ""}`,
            style: n.kind === "highlight"
              ? `background:${n.color}${strong ? "55" : "33"}`
              : `border-bottom:2px solid ${n.color};background:${n.color}${strong ? "33" : "14"}`,
            "data-note": n.id,
          }),
        );
      }
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin<DecorationSet>({
        key: notesKey,
        state: {
          init: (_c, state) => build(state.doc),
          apply: (tr, old, _o, state) => (tr.docChanged || tr.getMeta(notesKey) ? build(state.doc) : old),
        },
        props: { decorations: (state) => notesKey.getState(state) },
      }),
    ];
  },
});

/** Select the first occurrence of `term` (any case) and scroll to it. */
export function findAndSelect(editor: Editor, term: string): boolean {
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
