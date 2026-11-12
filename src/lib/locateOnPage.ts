/**
 * Find wording anywhere on the page, scroll to it and flash it: the "Read in context" jump for screens without a
 * script viewer of their own. Each call for the same wording goes to the next place it appears.
 */

const FLASH_NAME = "page-locate-flash";
const FLASH_COLOR = "#fb923c";
/** Wording inside an element with this attribute (the finding cards themselves) is never a match. */
export const LOCATE_SKIP_ATTR = "data-locate-skip";

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const registry = (): HighlightRegistry | null =>
  (globalThis as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS?.highlights ?? null;

let flashTimer: number | undefined;
const visits = new Map<string, number>();

/** Lowercase, plain quotes and dashes, single spaces: so the AI's quote matches what's on screen. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—]/g, "-");

/** Text with whitespace runs collapsed, and where each kept character came from. */
function collapse(raw: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) {
      if (!space && text) {
        text += " ";
        map.push(i);
      }
      space = true;
    } else {
      text += raw[i];
      map.push(i);
      space = false;
    }
  }
  return { text, map };
}

const cleanTerm = (term: string) => norm(term.trim().replace(/^["“'‘”’]+|["“'‘”’.]+$/g, "").replace(/\s+/g, " "));

const shown = (el: Element | null) => !!el && el.getClientRects().length > 0;
let exclude: Element | null = null;
const skipped = (el: Element | null) =>
  !el || !!el.closest(`[${LOCATE_SKIP_ATTR}],script,style,noscript,textarea`) || !!exclude?.contains(el);

type Hit = { at: Node; flash: () => void };

function textHits(needle: string): Hit[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      skipped(n.parentElement) || !shown(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

  // One string for the page, so wording split across elements (bold words, highlights) still matches.
  let raw = "";
  const starts: number[] = [];
  for (const n of nodes) {
    starts.push(raw.length);
    raw += n.data;
  }
  const { text, map } = collapse(norm(raw));
  const pointAt = (rawIdx: number): [Text, number] => {
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= rawIdx) lo = mid;
      else hi = mid - 1;
    }
    return [nodes[lo], rawIdx - starts[lo]];
  };

  const hits: Hit[] = [];
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
    const [sNode, sOff] = pointAt(map[i]);
    const [eNode, eOff] = pointAt(map[i + needle.length - 1]);
    const range = document.createRange();
    range.setStart(sNode, sOff);
    range.setEnd(eNode, eOff + 1);
    hits.push({ at: sNode, flash: () => flashRange(range) });
  }
  return hits;
}

function fieldHits(needle: string): Hit[] {
  const hits: Hit[] = [];
  document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>("textarea, input[type=text], input:not([type])").forEach((el) => {
    if (!shown(el) || el.closest(`[${LOCATE_SKIP_ATTR}]`) || exclude?.contains(el)) return;
    const { text, map } = collapse(norm(el.value));
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) {
      const start = map[i];
      const end = map[i + needle.length - 1] + 1;
      hits.push({
        at: el,
        flash: () => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
          el.setSelectionRange(start, end);
        },
      });
    }
  });
  return hits;
}

function flashRange(r: Range) {
  const el = r.startContainer instanceof Element ? r.startContainer : r.startContainer.parentElement;
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  const reg = registry();
  if (reg) {
    if (!document.getElementById(FLASH_NAME)) {
      const style = document.createElement("style");
      style.id = FLASH_NAME;
      style.textContent = `::highlight(${FLASH_NAME}){background-color:${FLASH_COLOR}99;color:inherit;}`;
      document.head.appendChild(style);
    }
    const Ctor = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight;
    reg.set(FLASH_NAME, new Ctor(r));
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => reg.delete(FLASH_NAME), 1800);
  } else {
    el?.animate?.([{ backgroundColor: "rgba(251, 146, 60, 0.5)" }, { backgroundColor: "transparent" }], { duration: 1800 });
  }
}

/**
 * Go to the wording on the page (the next place it appears each time). Falls back to the first several words when the
 * whole quote isn't on screen word for word. Wording inside `skip` (the card that was clicked) doesn't count. Returns
 * false when it isn't shown anywhere.
 */
export function locateOnPage(term: string, skip?: Element | null): boolean {
  const full = cleanTerm(term);
  if (!full) return false;
  exclude = skip ?? null;
  const words = full.split(" ");
  const tries = [full, ...(words.length > 6 ? [words.slice(0, 6).join(" "), words.slice(-6).join(" ")] : [])];
  for (const needle of tries) {
    const hits = [...textHits(needle), ...fieldHits(needle)].sort((a, b) =>
      a.at === b.at ? 0 : a.at.compareDocumentPosition(b.at) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    if (!hits.length) continue;
    const n = visits.get(full) ?? 0;
    visits.set(full, n + 1);
    hits[n % hits.length].flash();
    return true;
  }
  return false;
}
