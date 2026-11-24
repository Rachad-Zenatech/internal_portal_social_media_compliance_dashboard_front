import { sanitizeCaptionHtml } from "@/lib/sanitizeHtml";

export interface CaptionPart { text: string; tone: string; ruleId?: string; dismissed?: boolean }
interface TextRun { node: Text; start: number; end: number }
const BLOCKS = new Set(["P", "DIV", "BR", "LI", "H2", "H3", "BLOCKQUOTE", "UL", "OL"]);
const compact = (text: string) => text.replace(/\s+/g, " ").trim();
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Render rich captions using HTML whitespace rules; only add highlights to safe text nodes. */
export function captionPreviewHtml(html: string | undefined, parts: CaptionPart[]): string | null {
  if (!html?.trim()) return null;
  const doc = new DOMParser().parseFromString(sanitizeCaptionHtml(html), "text/html");
  const runs: TextRun[] = [];
  let text = "";
  function collect(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length;
      text += node.textContent ?? "";
      runs.push({ node: node as Text, start, end: text.length });
      return;
    }
    const block = node instanceof Element && BLOCKS.has(node.tagName);
    if (block) text += "\n";
    node.childNodes.forEach(collect);
    if (block) text += "\n";
  }
  collect(doc.body);
  // Never show saved HTML in place of newer wording still being edited.
  if (compact(text) !== compact(parts.map((part) => part.text).join(""))) return null;
  const matches = parts.filter((part) => part.tone && part.text.trim()).flatMap((part) => {
    const pattern = part.text.trim().split(/\s+/).map(escapePattern).join("\\s+");
    return [...text.matchAll(new RegExp(pattern, "gi"))].map((match) => ({
      start: match.index, end: match.index + match[0].length, tone: part.tone, ruleId: part.ruleId, dismissed: part.dismissed,
    }));
  });
  for (const run of runs) {
    const hits = matches.filter((match) => match.start < run.end && match.end > run.start);
    if (!hits.length) continue;
    const cuts = [...new Set([run.start, run.end, ...hits.flatMap((hit) => [
      Math.max(run.start, hit.start), Math.min(run.end, hit.end),
    ])])].sort((a, b) => a - b);
    const fragment = doc.createDocumentFragment();
    for (let i = 0; i < cuts.length - 1; i++) {
      const value = run.node.data.slice(cuts[i] - run.start, cuts[i + 1] - run.start);
      const covering = hits.filter((hit) => hit.start <= cuts[i] && hit.end >= cuts[i + 1]);
      if (!covering.length) { fragment.append(doc.createTextNode(value)); continue; }
      const mark = doc.createElement("mark");
      const chosen = covering.some((hit) => hit.tone === "chosen");
      mark.className = chosen ? "rounded bg-red-200 px-0.5 text-foreground ring-2 ring-red-500 dark:bg-red-500/40"
        : "rounded bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30";
      const finding = covering.find((hit) => hit.ruleId);
      if (finding?.ruleId) {
        mark.dataset.ruleId = finding.ruleId;
        mark.className += " cursor-pointer";
        mark.title = finding.dismissed ? "Dismissed: click to see why" : "Click to see the flag";
        if (finding.dismissed) mark.className += " border-b-2 border-dashed border-violet-500 bg-violet-200/60 dark:bg-violet-500/30";
      }
      mark.textContent = value;
      fragment.append(mark);
    }
    run.node.replaceWith(fragment);
  }
  return doc.body.innerHTML;
}
