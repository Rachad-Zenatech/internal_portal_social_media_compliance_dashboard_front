import type { JSONContent } from "@tiptap/react";

/**
 * A script is stored as plain text with light marks (see the backend's document_layout), so it can be checked, compared
 * word by word and edited by more than one person. The editor shows it as a document instead: these two functions turn
 * the text into the editor's content and back, so nobody types the marks.
 *
 *   "--- Page 2 ---"  a page break          "# Title" / "## " / "### "  headings
 *   "| a | b |"       a table row           "- item" / "1. item"        lists
 *   "**bold**"        bold                  "_italic_"                  italic
 */

const PAGE_LINE = /^--- Page (\d+) ---$/;
const HEADING_LINE = /^(#{1,3}) (.*)$/;
const TABLE_LINE = /^\|.*\|$/;
const BULLET_LINE = /^\s*[-•] (.*)$/;
const ORDERED_LINE = /^\s*(\d+)[.)] (.*)$/;

type Mark = { type: "bold" } | { type: "italic" };

// --- Text to document -------------------------------------------------------------------------------------------------

/** Italic runs: _word_ where the underscores sit at the edges of words, so snake_case_names are left alone. */
export const ITALIC = /(^|[\s(["'“])_(?=\S)([^_\n]*?\S)_(?=$|[\s)\].,;:!?"'”])/g;

function textNode(text: string, bold: boolean, italic: boolean): JSONContent {
  const marks: Mark[] = [];
  if (bold) marks.push({ type: "bold" });
  if (italic) marks.push({ type: "italic" });
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

function withItalics(text: string, bold: boolean): JSONContent[] {
  const out: JSONContent[] = [];
  let at = 0;
  for (const m of text.matchAll(ITALIC)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > at) out.push(textNode(text.slice(at, start), bold, false));
    out.push(textNode(m[2], bold, true));
    at = start + m[2].length + 2;
  }
  if (at < text.length) out.push(textNode(text.slice(at), bold, false));
  return out;
}

export function parseInline(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  let bold = false;
  text.split("**").forEach((part, i) => {
    if (i > 0) bold = !bold;
    if (part) out.push(...withItalics(part, bold));
  });
  return out;
}

const paragraph = (text: string): JSONContent => {
  const content = parseInline(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

function tableFrom(rows: string[]): JSONContent {
  return {
    type: "table",
    content: rows.map((line, r) => ({
      type: "tableRow",
      content: line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => ({ type: r === 0 ? "tableHeader" : "tableCell", content: [paragraph(cell.trim())] })),
    })),
  };
}

/** The editor's content for a script's text. */
export function textToDoc(text: string): JSONContent {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const content: JSONContent[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const page = PAGE_LINE.exec(trimmed);
    const heading = HEADING_LINE.exec(trimmed);
    if (page) {
      content.push({ type: "pageBreak" });
    } else if (heading) {
      const inner = heading[2].replace(/\*\*/g, "");
      content.push({ type: "heading", attrs: { level: heading[1].length }, content: inner ? [{ type: "text", text: inner }] : undefined });
    } else if (TABLE_LINE.test(trimmed)) {
      const rows = [trimmed];
      while (i + 1 < lines.length && TABLE_LINE.test(lines[i + 1].trim())) rows.push(lines[++i].trim());
      content.push(tableFrom(rows));
    } else if (BULLET_LINE.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && BULLET_LINE.test(lines[i])) items.push({ type: "listItem", content: [paragraph(BULLET_LINE.exec(lines[i++])![1])] });
      i--;
      content.push({ type: "bulletList", content: items });
    } else if (ORDERED_LINE.test(line)) {
      const first = ORDERED_LINE.exec(line)!;
      const items: JSONContent[] = [];
      while (i < lines.length && ORDERED_LINE.test(lines[i])) items.push({ type: "listItem", content: [paragraph(ORDERED_LINE.exec(lines[i++])![2])] });
      i--;
      content.push({ type: "orderedList", attrs: { start: Number(first[1]) }, content: items });
    } else {
      content.push(paragraph(trimmed));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

// --- Document to text -------------------------------------------------------------------------------------------------

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

function runsOf(nodes: JSONContent[] | undefined): Run[] {
  const runs: Run[] = [];
  for (const n of nodes ?? []) {
    if (n.type === "text" && n.text) {
      const names = (n.marks ?? []).map((m) => m.type);
      runs.push({ text: n.text, bold: names.includes("bold"), italic: names.includes("italic") });
    } else if (n.type === "hardBreak") {
      runs.push({ text: " ", bold: false, italic: false });
    }
  }
  return runs;
}

/** Runs as marked text: each bold or italic stretch wrapped, with the spacing around it left outside the marks. */
function writeRuns(runs: Run[]): string {
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic) last.text += r.text;
    else merged.push({ ...r });
  }
  return merged
    .map((r) => {
      if (!r.text.trim() || (!r.bold && !r.italic)) return r.text;
      const lead = r.text.slice(0, r.text.length - r.text.trimStart().length);
      const trail = r.text.slice(r.text.trimEnd().length);
      let core = r.text.trim();
      if (r.italic) core = `_${core}_`;
      if (r.bold) core = `**${core}**`;
      return lead + core + trail;
    })
    .join("");
}

const plain = (nodes: JSONContent[] | undefined) => runsOf(nodes).map((r) => r.text).join("");
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function cellText(cell: JSONContent): string {
  const text = (cell.content ?? []).map((p) => writeRuns(runsOf(p.content))).join(" ");
  return oneLine(text).replace(/\|/g, "/");
}

/** A script's text for the editor's content. */
export function docToText(doc: JSONContent): string {
  const blocks = doc.content ?? [];
  // A document that doesn't start with a page break has its first page unmarked, so the first break starts page 2.
  let page = blocks[0]?.type === "pageBreak" ? 0 : 1;
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "pageBreak":
        lines.push(`--- Page ${++page} ---`);
        break;
      case "heading":
        lines.push(`${"#".repeat(Math.min(3, Math.max(1, Number(b.attrs?.level ?? 1))))} ${oneLine(plain(b.content))}`);
        break;
      case "bulletList":
        for (const item of b.content ?? []) lines.push(`- ${oneLine((item.content ?? []).map((p) => writeRuns(runsOf(p.content))).join(" "))}`);
        break;
      case "orderedList": {
        let n = Number(b.attrs?.start ?? 1);
        for (const item of b.content ?? []) lines.push(`${n++}. ${oneLine((item.content ?? []).map((p) => writeRuns(runsOf(p.content))).join(" "))}`);
        break;
      }
      case "table":
        // Empty cells leave a double space, which the stored text keeps as one.
        for (const row of b.content ?? []) lines.push(`| ${(row.content ?? []).map(cellText).join(" | ")} |`.replace(/ {2,}/g, " "));
        break;
      default:
        lines.push(writeRuns(runsOf(b.content)));
    }
  }
  return lines.join("\n").replace(/\n+$/, "");
}
