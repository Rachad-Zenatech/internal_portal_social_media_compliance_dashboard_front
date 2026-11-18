import { locateInElement } from "@/lib/locateOnPage";

/** Only accept a selection wholly inside the caption, including selections across flagged spans. */
export function selectedCaptionText(container: HTMLElement | null, selection: Selection | null): string {
  if (!container || !selection || selection.isCollapsed || selection.rangeCount !== 1) return "";
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return "";
  return range.toString().trim();
}

/** Keep the exact caption excerpt in the saved comment, visible to both reviewer and creator. */
export function captionNoteBody(quote: string, note: string): string {
  const excerpt = quote.trim().split("\n").map((line) => `> ${line}`).join("\n");
  return `Caption excerpt:\n${excerpt}\n\n${note.trim()}`;
}
/** Read the excerpt saved with a caption comment, without including its note text. */
export function captionNoteExcerpt(body: string): string | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  if (lines.shift() !== "Caption excerpt:") return null;
  const quote: string[] = [];
  while (lines[0]?.startsWith("> ")) quote.push(lines.shift()!.slice(2));
  return lines[0] === "" && quote.join("\n").trim() ? quote.join("\n").trim() : null;
}

export const captionTextId = (submissionId: string) => `review-caption-${submissionId}`;

/** A comment click must only highlight its caption, never its own quoted comment body. */
export function highlightCaptionNote(submissionId: string, body: string): (() => void) | null {
  const quote = captionNoteExcerpt(body);
  const caption = document.getElementById(captionTextId(submissionId));
  return quote && caption ? locateInElement(quote, caption) : null;
}
