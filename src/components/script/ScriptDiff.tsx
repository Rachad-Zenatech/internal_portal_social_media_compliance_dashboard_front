import type { ReactNode } from "react";

import type { DiffPart } from "@/lib/wordDiff";
import type { ScriptStatus } from "@/types/script";

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Text with the given phrases marked (flagged wording). */
export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map(escapeRe).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-amber-200/80 px-0.5 text-foreground underline decoration-amber-600 decoration-2 underline-offset-2 dark:bg-amber-500/30">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const REMOVED = "rounded-sm bg-red-100 px-0.5 text-red-800 line-through decoration-red-500/70 dark:bg-red-500/20 dark:text-red-300";
const ADDED = "rounded-sm bg-emerald-100 px-0.5 text-emerald-900 no-underline dark:bg-emerald-500/20 dark:text-emerald-200";

/** One version with the other's changes marked in place: removed wording struck through, added wording in green. */
export function InlineDiff({
  parts,
  terms = [],
  focusId,
  onPick,
  numbered = true,
  showChanges = true,
}: {
  parts: DiffPart[];
  /** Flagged wording to mark in the text. */
  terms?: string[];
  focusId?: number | null;
  onPick?: (id: number) => void;
  numbered?: boolean;
  /** Off: just the new version, as clean text. */
  showChanges?: boolean;
}) {
  if (isStructured(parts)) {
    return <StructuredDiff parts={parts} terms={terms} focusId={focusId} onPick={onPick} numbered={numbered} showChanges={showChanges} />;
  }
  return (
    <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.85] text-foreground">
      {parts.map((p, k) => {
        if (p.kind === "same") return <Highlighted key={k} text={p.after} terms={terms} />;
        // Changes are numbered in order from 0 (see wordDiff), matching the list beside the script.
        const n = p.id + 1;
        if (!showChanges) return <Highlighted key={k} text={p.added} terms={terms} />;
        const ring = focusId === p.id ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-card" : "";
        return (
          <span
            key={k}
            id={`change-${p.id}`}
            onClick={onPick ? () => onPick(p.id) : undefined}
            className={`scroll-mt-24 rounded-sm ${ring} ${onPick ? "cursor-pointer" : ""}`}
          >
            {p.removed.trim() && <del className={REMOVED}>{p.removed.replace(/\s+$/, "")}</del>}
            {p.removed.trim() && p.added.trim() && " "}
            {p.added.trim() && <ins className={ADDED}>{p.added.replace(/\s+$/, "")}</ins>}
            {numbered && <sup className="ml-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">{n}</sup>}
            {/\s$/.test(p.added || p.removed) ? (p.added || p.removed).match(/\s+$/)?.[0] : ""}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scripts read from Word and PDF files keep their layout as light marks (see the backend's document_layout):
//   "--- Page 2 ---" a new page, "# Title" a heading, "| a | b |" a table row, "**bold**" bold wording.
// ---------------------------------------------------------------------------

const PAGE_LINE = /^--- Page (\d+) ---$/;
const HEADING_LINE = /^#{1,3} /;
const TABLE_LINE = /^\|.*\|$/;

/** Whether any of the visible text uses those marks. */
export function isStructured(parts: DiffPart[]): boolean {
  const text = parts.map((p) => (p.kind === "same" ? p.after : p.added)).join("");
  return /^(--- Page \d+ ---|# |\|.*\|)\s*$/m.test(text);
}

interface Seg {
  text: string;
  kind: "same" | "del" | "ins";
  changeId?: number;
  /** The change's number, shown after this piece. */
  number?: number;
}

/** The parts as lines of pieces: newlines in kept and added wording start a line; removed wording stays inline. */
function toLines(parts: DiffPart[], showChanges: boolean, numbered: boolean): Seg[][] {
  const lines: Seg[][] = [[]];
  const add = (text: string, kind: Seg["kind"], changeId?: number): Seg | null => {
    let last: Seg | null = null;
    text
      .replace(/\r/g, "")
      .split("\n")
      .forEach((piece, i) => {
        if (i > 0) lines.push([]);
        if (piece) {
          last = { text: piece, kind, changeId };
          lines[lines.length - 1].push(last);
        }
      });
    return last;
  };
  for (const p of parts) {
    if (p.kind === "same") {
      add(p.after, "same");
    } else if (!showChanges) {
      add(p.added, "same");
    } else {
      if (p.removed.trim()) lines[lines.length - 1].push({ text: p.removed.replace(/\s+/g, " ").trimEnd(), kind: "del", changeId: p.id });
      const last = add(p.added, "ins", p.id);
      if (numbered) {
        if (last) (last as Seg).number = p.id + 1;
        else lines[lines.length - 1].push({ text: "", kind: "ins", changeId: p.id, number: p.id + 1 });
      }
    }
  }
  return lines;
}

const visible = (segs: Seg[]) =>
  segs
    .filter((s) => s.kind !== "del")
    .map((s) => s.text)
    .join("");

/** The pieces with their first `n` visible characters removed (a "# " mark). */
function dropChars(segs: Seg[], n: number): Seg[] {
  let left = n;
  const out: Seg[] = [];
  for (const s of segs) {
    if (s.kind === "del" || left <= 0) {
      out.push(s);
      continue;
    }
    const cut = Math.min(left, s.text.length);
    left -= cut;
    out.push({ ...s, text: s.text.slice(cut) });
  }
  return out;
}

/** A table row's cells: the pieces split at each "|", without the outer edges. */
function cellsOf(segs: Seg[]): Seg[][] {
  const cells: Seg[][] = [[]];
  for (const s of segs) {
    if (s.kind === "del") {
      cells[cells.length - 1].push(s);
      continue;
    }
    const pieces = s.text.split("|");
    pieces.forEach((piece, i) => {
      if (i > 0) cells.push([]);
      const lastPiece = i === pieces.length - 1;
      if (piece || (lastPiece && s.number)) cells[cells.length - 1].push({ ...s, text: piece, number: lastPiece ? s.number : undefined });
    });
  }
  const blank = (c: Seg[]) => visible(c).trim() === "" && !c.some((s) => s.kind === "del" || s.number);
  if (cells.length && blank(cells[0])) cells.shift();
  if (cells.length && blank(cells[cells.length - 1])) cells.pop();
  return cells;
}

type Block =
  | { type: "heading"; segs: Seg[] }
  | { type: "text"; segs: Seg[] }
  | { type: "table"; rows: Seg[][][] }
  | { type: "gap" };

interface Sheet {
  number: number | null;
  blocks: Block[];
}

function toSheets(lines: Seg[][]): Sheet[] {
  const sheets: Sheet[] = [{ number: null, blocks: [] }];
  for (const line of lines) {
    const text = visible(line).trim();
    const sheet = sheets[sheets.length - 1];
    const page = PAGE_LINE.exec(text);
    if (page) {
      sheets.push({ number: Number(page[1]), blocks: [] });
    } else if (HEADING_LINE.test(text)) {
      const raw = visible(line);
      const mark = raw.indexOf("#");
      sheet.blocks.push({ type: "heading", segs: dropChars(line, mark + raw.slice(mark).indexOf(" ") + 1) });
    } else if (TABLE_LINE.test(text)) {
      const rows = cellsOf(line);
      const last = sheet.blocks[sheet.blocks.length - 1];
      if (last?.type === "table") last.rows.push(rows);
      else sheet.blocks.push({ type: "table", rows: [rows] });
    } else if (!text && !line.some((s) => s.kind !== "same")) {
      if (sheet.blocks.length && sheet.blocks[sheet.blocks.length - 1].type !== "gap") sheet.blocks.push({ type: "gap" });
    } else {
      sheet.blocks.push({ type: "text", segs: line });
    }
  }
  return sheets.filter((s) => s.blocks.some((b) => b.type !== "gap"));
}

function StructuredDiff({
  parts,
  terms,
  focusId,
  onPick,
  numbered,
  showChanges,
}: {
  parts: DiffPart[];
  terms: string[];
  focusId?: number | null;
  onPick?: (id: number) => void;
  numbered: boolean;
  showChanges: boolean;
}) {
  const sheets = toSheets(toLines(parts, showChanges, numbered));
  const seen = new Set<number>();

  /** One line's pieces, with **bold** toggling as it goes and changes marked in place. */
  const inline = (segs: Seg[], forceBold = false) => {
    let bold = false;
    return segs.map((s, i) => {
      const nodes = s.text.split("**").map((chunk, c) => {
        if (c > 0) bold = !bold;
        if (!chunk) return null;
        const body = s.kind === "del" ? chunk : <Highlighted text={chunk} terms={terms} />;
        const weighted = bold || forceBold ? <strong className="font-semibold">{body}</strong> : body;
        if (s.kind === "del") return <del key={c} className={REMOVED}>{weighted}</del>;
        if (s.kind === "ins") return <ins key={c} className={ADDED}>{weighted}</ins>;
        return <span key={c}>{weighted}</span>;
      });
      if (s.changeId == null) return <span key={i}>{nodes}</span>;
      const first = !seen.has(s.changeId);
      seen.add(s.changeId);
      const ring = focusId === s.changeId ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-card" : "";
      return (
        <span
          key={i}
          id={first ? `change-${s.changeId}` : undefined}
          onClick={onPick ? () => onPick(s.changeId!) : undefined}
          className={`scroll-mt-24 rounded-sm ${ring} ${onPick ? "cursor-pointer" : ""}`}
        >
          {nodes}
          {s.number != null && <sup className="ml-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">{s.number}</sup>}
        </span>
      );
    });
  };

  const render = (b: Block, key: number) => {
    if (b.type === "gap") return <div key={key} className="h-2" />;
    if (b.type === "heading") {
      return (
        <h3 key={key} className="mb-2 mt-1 text-lg font-semibold leading-snug text-foreground first:mt-0">
          {inline(b.segs, true)}
        </h3>
      );
    }
    if (b.type === "text") {
      return (
        <p key={key} className="my-1 whitespace-pre-wrap break-words text-[14px] leading-[1.7] text-foreground">
          {inline(b.segs)}
        </p>
      );
    }
    const [head, ...body] = b.rows;
    const narrow = (col: number) => b.rows.every((r) => visible(r[col] ?? []).replace(/\*\*/g, "").trim().length <= 8);
    return (
      <div key={key} className="my-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[13px] leading-snug">
          <thead>
            <tr className="bg-slate-800 text-white dark:bg-slate-700">
              {head.map((cell, c) => (
                <th key={c} className={`px-3 py-2 text-left align-top font-semibold ${narrow(c) ? "whitespace-nowrap" : ""}`}>
                  {inline(cell, true)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className={r % 2 ? "bg-muted/40" : ""}>
                {head.map((_, c) => (
                  <td key={c} className={`border-t border-border px-3 py-2 align-top ${narrow(c) ? "whitespace-nowrap text-muted-foreground" : ""}`}>
                    {inline(row[c] ?? [])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const paged = sheets.some((s) => s.number != null);
  const total = Math.max(0, ...sheets.map((s) => s.number ?? 0));
  return (
    <div className="space-y-4 text-foreground">
      {sheets.map((sheet, i) => (
        <section
          key={i}
          aria-label={sheet.number != null ? `Page ${sheet.number}` : "Script"}
          className={paged ? "rounded-xl border border-border bg-card px-6 py-6 shadow-xs sm:px-8" : ""}
        >
          {sheet.blocks.map(render)}
          {paged && sheet.number != null && (
            <p className="mt-4 border-t border-border/70 pt-2 text-right text-[11px] font-medium text-muted-foreground">
              Page {sheet.number} of {total}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

/** The two versions next to each other: removed wording marked on the left, added wording on the right. */
export function SideBySide({
  parts,
  left,
  right,
  focusId,
  onPick,
}: {
  parts: DiffPart[];
  left: { title: string; sub?: string };
  right: { title: string; sub?: string };
  focusId?: number | null;
  onPick?: (id: number) => void;
}) {
  const column = (side: "before" | "after") =>
    parts.map((p, k) => {
      if (p.kind === "same") return <span key={k}>{side === "before" ? p.before : p.after}</span>;
      const text = side === "before" ? p.removed : p.added;
      if (!text.trim()) return null;
      const ring = focusId === p.id ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-card" : "";
      return (
        <span key={k} onClick={onPick ? () => onPick(p.id) : undefined} className={`${onPick ? "cursor-pointer" : ""}`}>
          <span className={`${side === "before" ? "rounded-sm bg-red-100 px-0.5 text-red-800 dark:bg-red-500/20 dark:text-red-300" : ADDED} ${ring}`}>
            {text.replace(/\s+$/, "")}
          </span>
          {text.match(/\s+$/)?.[0] ?? ""}
        </span>
      );
    });
  const pane = (head: { title: string; sub?: string }, body: ReactNode, tint: string) => (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className={`flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-2.5 ${tint}`}>
        <span className="text-sm font-semibold text-foreground">{head.title}</span>
        {head.sub && <span className="text-xs text-muted-foreground">{head.sub}</span>}
      </header>
      <div className="whitespace-pre-wrap break-words px-5 py-4 text-[14px] leading-[1.8] text-foreground">{body}</div>
    </article>
  );
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pane(left, column("before"), "bg-muted/40")}
      {pane(right, column("after"), "bg-emerald-50/60 dark:bg-emerald-500/5")}
    </div>
  );
}

/** "Removed" / "Added" key for the marks above. */
export function DiffLegend() {
  return (
    <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
      <span className={REMOVED}>removed</span>
      <span className={ADDED}>added</span>
    </span>
  );
}

/** The two stages of a video post, with where this one is. */
export function StageSteps({ status, compact = false }: { status?: ScriptStatus | null; compact?: boolean }) {
  const approved = status === "APPROVED";
  const scriptLabel: Record<ScriptStatus, string> = {
    DRAFT: "Script · not sent yet",
    IN_REVIEW: "Script · with a reviewer",
    EDITS_PROPOSED: "Script · reviewer edited it",
    CHANGES_REQUESTED: "Script · changes requested",
    APPROVED: "Script · approved",
  };
  const creatorTurn = status === "EDITS_PROPOSED" || status === "CHANGES_REQUESTED";
  const first = approved
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
    : creatorTurn
    ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
    : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <ol aria-label="Post stages" className={`flex flex-wrap items-center gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
      <li className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold ${first}`}>
        <span className="grid h-4 w-4 place-items-center rounded-full bg-current/15 text-[10px]">{approved ? "✓" : "1"}</span>
        {scriptLabel[status ?? "DRAFT"]}
      </li>
      <li aria-hidden className="h-px w-5 bg-border" />
      <li
        className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium ${
          approved ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-muted text-muted-foreground"
        }`}
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-current/15 text-[10px]">2</span>
        {approved ? "Video · ready to upload" : "Video · after the script is approved"}
      </li>
    </ol>
  );
}
