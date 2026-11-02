/**
 * Word-by-word comparison of two versions of a script, for showing what a reviewer (or creator) changed.
 *
 * Words are compared without their spacing, so re-flowed lines don't count as changes. Each change comes out as one
 * piece of removed text followed by one piece of added text, so "combat proven" -> "tested in field trials" reads as
 * a single change rather than alternating fragments.
 */

export type DiffPart =
  | { kind: "same"; before: string; after: string }
  | { kind: "change"; id: number; removed: string; added: string };

/** Words with the spacing after them; any leading spacing is its own piece. */
function tokens(text: string): string[] {
  const out = text.match(/\s+|\S+\s*/g) ?? [];
  return out;
}

const key = (t: string) => t.trim();

/** Longest common subsequence of the two token lists, as matched index pairs. Falls back to lines when large. */
function matches(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  // A table this size is fine in the browser; past it, compare line by line instead (see diffWords).
  const lengths = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[at(i, j)] = key(a[i]) === key(b[j]) ? lengths[at(i + 1, j + 1)] + 1 : Math.max(lengths[at(i + 1, j)], lengths[at(i, j + 1)]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i]) === key(b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (lengths[at(i + 1, j)] >= lengths[at(i, j + 1)]) i++;
    else j++;
  }
  return pairs;
}

const MAX_CELLS = 6_000_000;

function diffTokens(a: string[], b: string[]): DiffPart[] {
  // Unchanged start and end are matched directly, which keeps the table small for typical edits.
  let start = 0;
  while (start < a.length && start < b.length && key(a[start]) === key(b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && key(a[endA - 1]) === key(b[endB - 1])) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const pairs: [number, number][] =
    (midA.length + 1) * (midB.length + 1) <= MAX_CELLS ? matches(midA, midB) : [];

  const parts: DiffPart[] = [];
  let id = 0;
  const same = (i: number, j: number) => parts.push({ kind: "same", before: a[i], after: b[j] });
  const change = (removed: string, added: string) => {
    if (!removed && !added) return;
    parts.push({ kind: "change", id: id++, removed, added });
  };
  for (let k = 0; k < start; k++) same(k, k);
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [midA.length, midB.length] as [number, number]]) {
    change(midA.slice(i, pi).join(""), midB.slice(j, pj).join(""));
    if (pi < midA.length) same(start + pi, start + pj);
    i = pi + 1;
    j = pj + 1;
  }
  for (let k = 0; k < a.length - endA; k++) same(endA + k, endB + k);
  return merge(parts);
}

/** Join changes split only by a matched space or a single short word ("the", "a"), so each edit reads as one. */
function merge(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const prev = out[out.length - 1];
    const next = parts[k + 1];
    if (p.kind === "same" && prev?.kind === "change" && next?.kind === "change" && /^\s*\S{0,3}\s*$/.test(p.after) && !/\n/.test(p.after)) {
      prev.removed += p.before;
      prev.added += p.after;
      continue;
    }
    if (p.kind === "change" && prev?.kind === "change") {
      prev.removed += p.removed;
      prev.added += p.added;
      continue;
    }
    out.push(p.kind === "change" ? { ...p } : p);
  }
  let id = 0;
  return out.map((p) => (p.kind === "change" ? { ...p, id: id++ } : p));
}

/** What changed from `before` to `after`, word by word. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before.replace(/\r\n/g, "\n"));
  const b = tokens(after.replace(/\r\n/g, "\n"));
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS * 4) {
    // Very long scripts: compare whole lines, which is quick and still shows where the edits are.
    const la = before.split(/(?<=\n)/);
    const lb = after.split(/(?<=\n)/);
    return diffTokens(la, lb);
  }
  return diffTokens(a, b);
}

/** The changes alone, numbered from 1, with a few words before each for context. */
export function changesOf(parts: DiffPart[]): { id: number; number: number; removed: string; added: string; before: string }[] {
  const list: { id: number; number: number; removed: string; added: string; before: string }[] = [];
  parts.forEach((p, k) => {
    if (p.kind !== "change") return;
    let before = "";
    for (let q = k - 1; q >= 0 && before.length < 40; q--) {
      const prev = parts[q];
      before = (prev.kind === "same" ? prev.after : prev.added) + before;
    }
    // Only the words on the same line: a scene heading above isn't useful context.
    const line = before.split("\n").pop() ?? "";
    const words = line.trim().split(/\s+/).filter(Boolean).slice(-5).join(" ");
    list.push({ id: p.id, number: list.length + 1, removed: p.removed.trim(), added: p.added.trim(), before: words });
  });
  return list;
}
