/** Keep the post and review controls visible on laptop-width screens. */
export function queueStartsCollapsed(width: number, saved: string | null = null): boolean {
  return width < 1800 || saved === "1";
}

export function initialQueueCollapsed(storageKey: string): boolean {
  const width = typeof window === "undefined" ? 1800 : window.innerWidth;
  try { return queueStartsCollapsed(width, localStorage.getItem(storageKey)); }
  catch { return queueStartsCollapsed(width); }
}
