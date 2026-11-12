import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MessageSquarePlus, MessageSquareText, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Reviewer's highlights and margin notes on the script's wording (saved with the script version, so the creator sees them).
 *
 * Highlights are painted with the CSS Custom Highlight API, so the script's own markup is never touched; each one is
 * stored as the quoted wording plus where it started, and found again by its wording if the text moves.
 */

export type Highlight = { id: string; start: number; text: string; color: string; note: string; done?: boolean; updated?: string | null };

export type HighlightableHandle = {
  /** Scroll to the n-th place any of these phrases appears and flash it. Returns how many places there are. */
  locate: (terms: string[], nth: number) => number;
  /** Scroll to one highlight and flash it. Returns false when its wording can't be found any more. */
  goTo: (id: string) => boolean;
  /** Scroll to the end of the script. */
  toEnd: () => void;
};

export const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#7dd3fc", "#f9a8d4", "#fdba74"];
const FLASH = "#fb923c";
const GUTTER = 40;

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const registry = (): HighlightRegistry | null => {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistry } }).CSS;
  return css?.highlights && typeof (globalThis as { Highlight?: unknown }).Highlight === "function" ? css.highlights : null;
};
const makeHighlight = (ranges: Range[]) => new (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight(...ranges);

const colorName = (hex: string) => `hl-${hex.replace(/[^0-9a-f]/gi, "").toLowerCase()}`;

/** The text nodes under `root`, with where each starts in the root's text. */
function textNodes(root: HTMLElement) {
  const nodes: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let at = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: at });
    at += (n as Text).data.length;
  }
  return { nodes, text: nodes.map((n) => n.node.data).join("") };
}

function rangeAt(nodes: { node: Text; start: number }[], from: number, to: number): Range | null {
  const a = nodes.find((n) => from >= n.start && from < n.start + n.node.data.length);
  // Find node b where `to` falls within the node's span, or exactly at its end boundary
  const b = nodes.find((n) => to > n.start && to <= n.start + n.node.data.length);
  if (!a || !b) return null;
  const r = document.createRange();
  r.setStart(a.node, Math.min(from - a.start, a.node.data.length));
  r.setEnd(b.node, Math.min(to - b.start, b.node.data.length));
  return r;
}

/** Where a stored highlight is now: its saved spot if the wording is still there, else the nearest copy of it. */
function resolve(text: string, h: Highlight): number {
  if (text.substr(h.start, h.text.length) === h.text) return h.start;
  let best = -1;
  for (let i = text.indexOf(h.text); i !== -1; i = text.indexOf(h.text, i + 1)) {
    if (best === -1 || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
  }
  return best;
}

type Draft = { start: number; text: string; rect: { top: number; left: number; width: number }; existing: string[] };
/** One note icon per row: every highlight with a note on that row. */
type Marker = { key: string; top: number; ids: string[] };

const HighlightableText = forwardRef<
  HighlightableHandle,
  {
    /** The highlights to show. */
    value: Highlight[];
    /** Reviewers pass this to add, recolour, comment on and remove highlights; without it they're read-only. */
    onChange?: (next: Highlight[]) => void;
    /** Changes whenever the text shown changes, so highlights and notes are placed again. */
    layoutKey: unknown;
    children: ReactNode;
  }
>(function HighlightableText({ value: items, onChange, layoutKey, children }, ref) {
  const enabled = Boolean(onChange);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [writing, setWriting] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  /** The colour picker is open: dragging inside it must not dismiss the toolbar. */
  const pickerOpen = useRef(false);
  /** A colour chosen in the custom picker, waiting for "Select". */
  const [custom, setCustom] = useState<string | null>(null);
  const supported = useMemo(() => registry() != null, []);

  const save = useCallback((next: Highlight[]) => onChange?.(next), [onChange]);

  // The colours the highlights use, as ::highlight() rules (the API can't take a colour directly).
  const styleRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    const el = document.createElement("style");
    document.head.appendChild(el);
    styleRef.current = el;
    return () => el.remove();
  }, []);

  // Paint the highlights, and place each note's marker on its row.
  const paint = useCallback(() => {
    const root = contentRef.current;
    const wrap = wrapRef.current;
    const reg = registry();
    if (!root || !wrap) return;
    const { nodes, text } = textNodes(root);
    const byColor = new Map<string, Range[]>();
    const noted: { id: string; top: number }[] = [];
    const wrapTop = wrap.getBoundingClientRect().top;
    for (const h of items) {
      const at = resolve(text, h);
      const r = at === -1 ? null : rangeAt(nodes, at, at + h.text.length);
      if (!r) continue;
      byColor.set(h.color, [...(byColor.get(h.color) ?? []), r]);
      if (h.note) {
        const first = r.getClientRects()[0] ?? r.getBoundingClientRect();
        noted.push({ id: h.id, top: first.top - wrapTop });
      }
    }
    if (styleRef.current) {
      styleRef.current.textContent = [...new Set([...items.map((h) => h.color), FLASH])]
        .map((c) => `::highlight(${colorName(c)}){background-color:${c}99;color:inherit;}`)
        .join("\n");
    }
    if (reg) {
      for (const c of new Set(items.map((h) => h.color))) {
        const ranges = byColor.get(c);
        if (ranges) reg.set(colorName(c), makeHighlight(ranges));
        else reg.delete(colorName(c));
      }
    }
    // Notes on the same row share one icon; icons on neighbouring rows are kept from overlapping.
    noted.sort((x, y) => x.top - y.top);
    const nextMarkers: Marker[] = [];
    for (const n of noted) {
      const last = nextMarkers[nextMarkers.length - 1];
      if (last && n.top - last.top < 10) last.ids.push(n.id);
      else nextMarkers.push({ key: n.id, top: n.top, ids: [n.id] });
    }
    for (let i = 1; i < nextMarkers.length; i++) nextMarkers[i].top = Math.max(nextMarkers[i].top, nextMarkers[i - 1].top + 30);
    setMarkers((old) =>
      old.length === nextMarkers.length &&
        old.every((m, i) => m.key === nextMarkers[i].key && m.ids.join() === nextMarkers[i].ids.join() && Math.abs(m.top - nextMarkers[i].top) < 1)
        ? old
        : nextMarkers
    );
  }, [items]);

  useLayoutEffect(() => {
    paint();
  }, [paint, layoutKey]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    // Re-place the highlights at most once per frame while the panel is being dragged.
    let frame: number | null = null;
    const ro = new ResizeObserver(() => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        paint();
      });
    });
    ro.observe(root);
    return () => {
      ro.disconnect();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [paint]);

  // Clear what this component painted when it goes away.
  const colorsUsed = useRef<string[]>([]);
  colorsUsed.current = items.map((h) => h.color);
  useEffect(
    () => () => {
      const reg = registry();
      if (reg) for (const c of new Set([...HIGHLIGHT_COLORS, ...colorsUsed.current, FLASH])) reg.delete(colorName(c));
    },
    []
  );

  // The toolbar follows the reviewer's selection.
  useEffect(() => {
    if (!enabled) return;
    const onSelect = () => {
      const root = contentRef.current;
      const wrap = wrapRef.current;
      const sel = window.getSelection();
      if (!root || !wrap || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      if (!sel.toString().trim()) return;
      const { nodes, text } = textNodes(root);
      const first = nodes.find((n) => n.node === range.startContainer);
      const last = nodes.find((n) => n.node === range.endContainer);
      if (!first || !last) return;
      const start = first.start + range.startOffset;
      const end = last.start + range.endOffset;
      if (end <= start) return;
      const box = range.getBoundingClientRect();
      const wb = wrap.getBoundingClientRect();
      const overlapping = items.filter((h) => {
        const at = resolve(text, h);
        return at !== -1 && at < end && at + h.text.length > start;
      });
      setWriting(false);
      setCustom(null);
      setNoteText(overlapping.find((h) => h.note)?.note ?? "");
      setDraft({
        start,
        text: text.slice(start, end),
        rect: { top: box.top - wb.top, left: box.left - wb.left, width: box.width },
        existing: overlapping.map((h) => h.id),
      });
    };
    // Wait for the mouse button to come up, so the toolbar doesn't jump around while dragging.
    const onUp = (e: Event) => {
      if (pickerOpen.current) return;
      if (e.target instanceof Node && wrapRef.current?.querySelector('[data-highlight-toolbar]')?.contains(e.target)) return;
      window.setTimeout(onSelect, 0);
    };
    const onDown = (e: MouseEvent) => {
      if (e.target instanceof Node && wrapRef.current?.querySelector('[data-highlight-toolbar]')?.contains(e.target)) return;
      // A click on the page itself (the picker popup is outside it) dismisses the toolbar and ends the picker guard.
      pickerOpen.current = false;
      setDraft(null);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keyup", onUp);
    };
  }, [enabled, items]);

  const closeToolbar = () => {
    // The picker input may never get a blur (the toolbar keeps focus where it is), so end its guard here.
    pickerOpen.current = false;
    setDraft(null);
    setWriting(false);
    window.getSelection()?.removeAllRanges();
  };

  const apply = (color: string | null, note: string | null) => {
    if (!draft) return;
    const { nodes: _n, text } = contentRef.current ? textNodes(contentRef.current) : { nodes: [], text: "" };
    void _n;
    const overlapping = items.filter((h) => draft.existing.includes(h.id));
    const selStart = draft.start;
    const selEnd = draft.start + draft.text.length;
    const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    if (note != null) {
      // A note goes on the first highlight in the selection, or on a new one.
      const base = overlapping[0];
      if (base) save(items.map((h) => (h.id === base.id ? { ...h, note } : h)));
      else save([...items, { id: newId(), start: selStart, text: draft.text, color: HIGHLIGHT_COLORS[0], note }]);
      closeToolbar();
      return;
    }
    if (!color) return;

    // Every highlight the selection touches takes the new colour, and wording not highlighted yet gets it too.
    const spans = overlapping
      .map((h) => ({ at: resolve(text, h), len: h.text.length }))
      .filter((x) => x.at !== -1)
      .sort((x, y) => x.at - y.at);
    const gaps: { at: number; end: number }[] = [];
    let cursor = selStart;
    for (const sp of spans) {
      if (sp.at > cursor) gaps.push({ at: cursor, end: Math.min(sp.at, selEnd) });
      cursor = Math.max(cursor, sp.at + sp.len);
    }
    if (cursor < selEnd) gaps.push({ at: cursor, end: selEnd });
    const added = gaps
      .map((g) => ({ at: g.at, piece: text.slice(g.at, g.end) }))
      .filter((g) => g.piece.trim())
      .map((g) => ({ id: newId(), start: g.at, text: g.piece, color, note: "" }));
    save([...items.map((h) => (draft.existing.includes(h.id) ? { ...h, color } : h)), ...added]);
    closeToolbar();
  };

  const remove = (id: string) => {
    const gone = items.find((h) => h.id === id);
    save(items.filter((h) => h.id !== id));
    if (gone) registry()?.delete(colorName(gone.color)); // repainted below if other highlights share the colour
    setOpenNote(null);
    closeToolbar();
  };

  /** Scroll a stretch of the script into view and flash it. */
  const reveal = (r: Range) => {
    const el = r.startContainer instanceof Element ? r.startContainer : r.startContainer.parentElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const reg = registry();
    if (reg) {
      reg.set(colorName(FLASH), makeHighlight([r]));
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => reg.delete(colorName(FLASH)), 1800);
    } else if (el) {
      // Fallback pulse animation if CSS Custom Highlight API is not supported
      el.animate?.(
        [
          { backgroundColor: "rgba(251, 146, 60, 0.5)" },
          { backgroundColor: "transparent" },
        ],
        { duration: 1800, iterations: 1 }
      );
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      locate: (terms, nth) => {
        const root = contentRef.current;
        if (!root) return 0;
        const { nodes, text } = textNodes(root);
        const lower = text.toLowerCase();
        const hits: { at: number; len: number }[] = [];
        for (const raw of terms.filter(Boolean)) {
          // Normalize whitespace and strip enclosing quotes if present
          const clean = raw.trim().replace(/^["“'”]+|["“'”]+$/g, "");
          const candidateTerms = [clean, clean.replace(/\s+/g, " ")].filter(Boolean);
          for (const t of new Set(candidateTerms)) {
            const needle = t.toLowerCase();
            for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
              hits.push({ at: i, len: needle.length });
            }
          }
          // If multi-word phrase didn't match directly, try sub-phrases of 3+ words
          if (hits.length === 0 && clean.includes(" ")) {
            const words = clean.split(/\s+/).filter(Boolean);
            if (words.length >= 3) {
              const windowSize = Math.min(words.length, 4);
              for (let w = 0; w <= words.length - windowSize; w++) {
                const sub = words.slice(w, w + windowSize).join(" ").toLowerCase();
                for (let i = lower.indexOf(sub); i !== -1; i = lower.indexOf(sub, i + sub.length)) {
                  hits.push({ at: i, len: sub.length });
                }
              }
            }
          }
        }
        if (hits.length === 0) return 0;
        // Deduplicate overlapping/identical hits
        const uniqueHits = hits.filter(
          (h, idx, self) => self.findIndex((o) => o.at === h.at && o.len === h.len) === idx
        );
        uniqueHits.sort((a, b) => a.at - b.at);
        const hit = uniqueHits[((nth % uniqueHits.length) + uniqueHits.length) % uniqueHits.length];
        const r = rangeAt(nodes, hit.at, hit.at + hit.len);
        if (!r) return 0;
        reveal(r);
        return uniqueHits.length;
      },
      goTo: (id) => {
        const root = contentRef.current;
        const h = itemsRef.current.find((x) => x.id === id);
        if (!root || !h) return false;
        const { nodes, text } = textNodes(root);
        const at = resolve(text, h);
        const r = at === -1 ? null : rangeAt(nodes, at, at + h.text.length);
        if (!r) return false;
        reveal(r);
        return true;
      },
      toEnd: () => {
        contentRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
      },
    }),
    []
  );

  const active = draft && enabled ? draft : null;
  const openMarker = markers.find((m) => m.key === openNote);
  const openItems = openMarker ? openMarker.ids.map((id) => items.find((h) => h.id === id)).filter((h): h is Highlight => Boolean(h)) : [];

  return (
    <div ref={wrapRef} className="relative" style={{ paddingRight: items.some((h) => h.note) ? GUTTER : 0 }}>
      <div ref={contentRef}>{children}</div>

      {/* Notes: one icon per row at the right edge; notes on the same row are stacked in it. */}
      {markers.map((m) => {
        const first = items.find((x) => x.id === m.ids[0]);
        if (!first) return null;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => setOpenNote((o) => (o === m.key ? null : m.key))}
            title={m.ids.length > 1 ? `${m.ids.length} notes on this row` : first.note}
            aria-label={`${m.ids.length} note${m.ids.length === 1 ? "" : "s"} on this row`}
            className="absolute right-1 grid h-7 w-7 place-items-center rounded-full border-2 bg-card shadow-sm hover:bg-muted"
            style={{ top: m.top - 2, borderColor: first.color }}
          >
            <MessageSquareText className="h-3.5 w-3.5 text-foreground/80" />
            {m.ids.length > 1 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] font-bold leading-none text-background">
                {m.ids.length}
              </span>
            )}
          </button>
        );
      })}
      {openMarker && openItems.length > 0 && (
        <div className="absolute right-10 z-30 w-64 rounded-lg border border-border bg-card p-3 text-xs shadow-lg" style={{ top: Math.max(0, openMarker.top - 4) }}>
          <button type="button" aria-label="Close notes" onClick={() => setOpenNote(null)} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
          {openItems.map((h, i) => (
            <div key={h.id} className={i > 0 ? "mt-2.5 border-t border-border pt-2.5" : ""}>
              <span className="block max-w-[calc(100%-1.25rem)] truncate font-medium text-foreground" style={{ borderBottom: `2px solid ${h.color}` }}>
                “{h.text.length > 36 ? `${h.text.slice(0, 36)}…` : h.text}”
              </span>
              <p className="mt-1.5 whitespace-pre-wrap text-foreground/90">{h.note}</p>
              {enabled && (
                <button type="button" onClick={() => remove(h.id)} className="mt-1.5 inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400">
                  <Trash2 className="h-3 w-3" /> Remove highlight
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* The toolbar above the selected wording. */}
      {active && (
        <div
          role="toolbar"
          aria-label="Highlight"
          // Found by this, not by role: the script editor has a toolbar of its own inside the same box.
          data-highlight-toolbar=""
          onMouseDown={(e) => {
            // Keep the selection while using the toolbar (but let the note box take focus).
            if (!(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) e.preventDefault();
          }}
          className="absolute z-30 flex -translate-x-1/2 flex-col gap-2 rounded-lg border border-border/70 bg-card/80 p-1.5 shadow-lg backdrop-blur-md"
          style={{
            top: Math.max(0, active.rect.top - (writing ? 112 : 46)),
            left: Math.max(120, Math.min(active.rect.left + active.rect.width / 2, (wrapRef.current?.clientWidth ?? 600) - 120)),
          }}
        >
          <div className="flex items-center gap-1">
            {!supported && <span className="px-1 text-[11px] text-muted-foreground">Highlights need a newer browser</span>}
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight ${c}`}
                onClick={() => apply(c, null)}
                className="h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-border" title="Pick a colour" aria-label="Custom colour">
              <span
                className="absolute inset-0"
                style={custom ? { backgroundColor: custom } : { backgroundImage: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" }}
              />
              <input
                type="color"
                className="absolute inset-0 cursor-pointer opacity-0"
                value={custom ?? "#fde047"}
                onChange={(e) => setCustom(e.target.value)}
                onClick={() => {
                  pickerOpen.current = true;
                }}
                onBlur={() => {
                  pickerOpen.current = false;
                }}
              />
            </label>
            {custom && (
              <Button type="button" size="sm" className="h-6 px-2 text-xs" onClick={() => apply(custom, null)}>
                Select
              </Button>
            )}
            <span className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              aria-label="Add a note"
              title="Add a note"
              onClick={() => setWriting((w) => !w)}
              className={`grid h-6 w-6 place-items-center rounded-md hover:bg-muted ${writing ? "bg-muted" : ""}`}
            >
              <MessageSquarePlus className="h-4 w-4 text-foreground/80" />
            </button>
            {active.existing.length > 0 && (
              <button
                type="button"
                aria-label="Remove highlight"
                title="Remove highlight"
                onClick={() => active.existing.forEach(remove)}
                className="grid h-6 w-6 place-items-center rounded-md hover:bg-muted"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            )}
          </div>
          {writing && (
            <div className="flex w-60 flex-col gap-1.5">
              <textarea
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Note on this wording…"
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-background/90 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-sky-500"
              />
              <Button type="button" size="sm" className="h-6 self-end px-2 text-xs" disabled={!noteText.trim()} onClick={() => apply(null, noteText.trim())}>
                Save note
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default HighlightableText;
