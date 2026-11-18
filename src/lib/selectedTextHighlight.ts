const NAME = "selected-caption-comment";

/** Highlight selected comment wording until its owner explicitly clears it. */
export function holdTextHighlight(range: Range): () => void {
  const element = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  const api = globalThis as unknown as {
    CSS?: { highlights?: { set: (key: string, value: unknown) => void; delete: (key: string) => void } };
    Highlight?: new (...ranges: Range[]) => unknown;
  };
  const registry = api.CSS?.highlights;
  if (registry && api.Highlight) {
    if (!document.getElementById(NAME)) {
      const style = document.createElement("style");
      style.id = NAME;
      style.textContent = `::highlight(${NAME}){background-color:#fb923c99;color:inherit;}`;
      document.head.appendChild(style);
    }
    registry.set(NAME, new api.Highlight(range));
    return () => registry.delete(NAME);
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return () => {
    if (selection?.rangeCount === 1 && selection.getRangeAt(0) === range) selection.removeAllRanges();
  };
}
