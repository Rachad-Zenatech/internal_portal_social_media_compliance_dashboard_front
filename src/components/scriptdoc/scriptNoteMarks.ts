import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

import type { DocNote } from "@/types/scriptDoc";
import { matchingQuote } from "../../lib/replaceQuote.ts";

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

interface TextSlice {
  from: number;
  to: number;
  strStart: number;
  strEnd: number;
  text: string;
}

function collectBlocks(doc: PMNode): { joined: string; slices: TextSlice[] } {
  const slices: TextSlice[] = [];
  let cursor = 0;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const text = node.textContent;
    if (slices.length > 0) cursor += 1; // "\n" separator between textblocks
    const strStart = cursor;
    cursor += text.length;
    slices.push({ from: pos + 1, to: pos + 1 + node.content.size, strStart, strEnd: cursor, text });
    return false;
  });
  return { joined: slices.map((s) => s.text).join("\n"), slices };
}

function strOffsetToDocPos(slices: TextSlice[], offset: number, preferEnd = false): number {
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    if (offset < s.strStart) return s.from;
    if (offset <= s.strEnd) {
      if (preferEnd && offset === s.strStart && i > 0) return slices[i - 1].to;
      return s.from + (offset - s.strStart);
    }
  }
  return slices.length ? slices[slices.length - 1].to : 0;
}

/** Read the current selection (even across multiple table cells or paragraphs) as { quote, start }. */
export function readSelection(editor: Editor): { quote: string; start: number } | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const quote = editor.state.doc.textBetween(from, to, "\n").trim();
  if (!quote) return null;
  const at = locate(editor.state.doc, { quote, start: from } as DocNote);
  return { quote, start: at ? at.from : from };
}

/** Where a note's wording is now: the occurrence nearest to where it started (the text moves as people edit). */
export function locate(doc: PMNode, note: DocNote): { from: number; to: number } | null {
  if (!note.quote) return null;
  let best: { from: number; to: number } | null = null;
  if (!note.quote.includes("\n")) {
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
    if (best) return best;
  }

  const { joined, slices } = collectBlocks(doc);
  let at = joined.indexOf(note.quote);
  while (at >= 0) {
    const from = strOffsetToDocPos(slices, at, false);
    const to = strOffsetToDocPos(slices, at + note.quote.length, true);
    if (from < to && (!best || Math.abs(from - note.start) < Math.abs(best.from - note.start))) {
      best = { from, to };
    }
    at = joined.indexOf(note.quote, at + 1);
  }
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
        const attrs = {
          class: `script-note script-note-${n.kind}${strong ? " script-note-active" : ""}`,
          style: n.text
            ? `border-bottom:2px solid ${n.color};background:${n.color}${strong ? "55" : "33"}`
            : `background:${n.color}${strong ? "55" : "33"}`,
          "data-note": n.id,
        };
        doc.nodesBetween(at.from, at.to, (node, pos) => {
          if (!node.isTextblock) return true;
          const s = Math.max(at.from, pos + 1);
          const e = Math.min(at.to, pos + 1 + node.content.size);
          if (s < e) decos.push(Decoration.inline(s, e, attrs));
          return false;
        });
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
  const { joined } = collectBlocks(editor.state.doc);
  const quote = matchingQuote(joined, term);
  const found = quote ? locate(editor.state.doc, { quote, start: 0 } as DocNote) : null;
  if (!found) return false;
  editor.chain().focus().setTextSelection(found).scrollIntoView().run();
  return true;
}
