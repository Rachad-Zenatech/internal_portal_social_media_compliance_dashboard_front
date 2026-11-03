import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const readWidth = (key: string): number | null => {
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

/** A panel's width, remembered per browser. `null` until the user drags it (then the stylesheet's own width applies). */
export function usePanelWidth(storageKey: string, min: number, max: number) {
  const key = `panelWidth.${storageKey}`;
  const [width, setWidthState] = useState<number | null>(() => readWidth(key));
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, Math.round(n))), [min, max]);

  const setWidth = useCallback(
    (n: number | null) => {
      const next = n == null ? null : clamp(n);
      setWidthState(next);
      try {
        if (next == null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, String(next));
      } catch {
        /* storage unavailable: the width just isn't remembered */
      }
    },
    [clamp, key]
  );

  return {
    width,
    setWidth,
    min,
    max,
    /** Spread on the panel: sets the width from lg up, once the user has dragged it. */
    panelProps: (width == null
      ? {}
      : { className: "lg:w-[var(--panel-w)] lg:max-w-[70vw]", style: { "--panel-w": `${width}px` } as CSSProperties }) as {
      className?: string;
      style?: CSSProperties;
    },
  };
}

/**
 * A draggable edge for a panel. `edge` is the side of the panel the handle sits on: a panel on the right of the page
 * is resized from its "left" edge, one on the left from its "right" edge. The panel must be `relative`.
 */
export function ResizeHandle({
  edge,
  panelRef,
  panel,
  label,
}: {
  edge: "left" | "right";
  panelRef: React.RefObject<HTMLElement | null>;
  panel: ReturnType<typeof usePanelWidth>;
  label: string;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const frame = useRef<number | null>(null);
  const latest = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const sign = edge === "left" ? -1 : 1;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const w = panelRef.current?.getBoundingClientRect().width;
    if (!w) return;
    start.current = { x: e.clientX, w };
    latest.current = null;
    // Make sure the panel is sized by its width variable, so the drag can move it without re-rendering the page.
    if (panel.width == null) panel.setWidth(w);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const next = Math.min(panel.max, Math.max(panel.min, Math.round(start.current.w + sign * (e.clientX - start.current.x))));
    latest.current = next;
    // Move the panel directly, once per frame; React and storage only hear about the final width.
    if (frame.current == null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (latest.current != null) panelRef.current?.style.setProperty("--panel-w", `${latest.current}px`);
      });
    }
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    if (frame.current != null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (latest.current != null) panel.setWidth(latest.current);
    setDragging(false);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const w = panelRef.current?.getBoundingClientRect().width ?? 0;
    const step = e.shiftKey ? 48 : 16;
    // Moving the edge left widens a panel resized from its left edge, and narrows one resized from its right edge.
    const toLeft = edge === "left" ? step : -step;
    if (e.key === "ArrowLeft") panel.setWidth(w + toLeft);
    else if (e.key === "ArrowRight") panel.setWidth(w - toLeft);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={panel.min}
      aria-valuemax={panel.max}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={() => panel.setWidth(null)}
      onKeyDown={onKey}
      title="Drag to resize · double-click to reset"
      className={`absolute inset-y-0 z-20 hidden w-2 cursor-col-resize touch-none lg:block ${edge === "left" ? "-left-1" : "-right-1"} group outline-none`}
    >
      <span
        className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-sky-500/70 group-focus-visible:bg-sky-500 ${
          dragging ? "bg-sky-500" : "bg-transparent"
        }`}
      />
    </div>
  );
}

/**
 * A side panel whose width the user can drag. Until they do, `defaultWidth` (the panel's usual responsive widths)
 * applies; the width they pick is remembered under `storageKey`.
 */
export function ResizablePanel({
  as: Tag,
  label,
  storageKey,
  edge,
  min,
  max,
  className,
  defaultWidth,
  children,
}: {
  as: "aside" | "section";
  label: string;
  storageKey: string;
  edge: "left" | "right";
  min: number;
  max: number;
  className: string;
  defaultWidth: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const panel = usePanelWidth(storageKey, min, max);
  const custom = panel.panelProps;
  return (
    <Tag
      ref={ref as never}
      aria-label={label}
      className={`relative ${className} ${custom.className ?? defaultWidth}`}
      style={custom.style}
    >
      <ResizeHandle edge={edge} panelRef={ref} panel={panel} label={`Resize ${label.toLowerCase()}`} />
      {children}
    </Tag>
  );
}
