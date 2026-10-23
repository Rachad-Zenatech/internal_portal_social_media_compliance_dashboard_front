/**
 * Put a suggested revision in place of the wording a finding quotes. The quote is checked on the server with
 * punctuation, spacing, case and curly quotes ignored, so it's found the same way here: word by word, with anything
 * that isn't part of a word allowed in between.
 */

const WORD = /[\p{L}\p{N}_$%']+/gu;

function quotePattern(quote: string): RegExp | null {
  const words = quote.replace(/[‘’]/g, "'").match(WORD);
  if (!words?.length) return null;
  const parts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['‘’]"));
  return new RegExp(`(?<![\\p{L}\\p{N}_$%'‘’])${parts.join("[^\\p{L}\\p{N}_$%'‘’]+")}(?![\\p{L}\\p{N}_$%'‘’])`, "iu");
}

/** Where the quote is in text: [start, end), taking in a closing punctuation mark the revision already ends with. */
function locate(text: string, quote: string, revision: string): [number, number] | null {
  const pattern = quotePattern(quote);
  const m = pattern ? pattern.exec(text) : null;
  if (!m) return null;
  let end = m.index + m[0].length;
  const last = revision.trim().slice(-1);
  if (/[.!?,;:]/.test(last) && text[end] === last) end += 1;
  return [m.index, end];
}

/** The text with the quoted wording replaced, or null when it isn't there. */
export function replaceInText(text: string, quote: string, revision: string): string | null {
  const at = locate(text, quote, revision);
  return at ? text.slice(0, at[0]) + revision.trim() + text.slice(at[1]) : null;
}

/**
 * Replace the quoted wording inside a rich-text (contentEditable) editor, keeping its formatting elsewhere. Uses the
 * browser's own editing command, so the editor's Undo takes it back. False when the wording isn't there.
 */
export function replaceInEditable(root: HTMLElement, quote: string, revision: string): boolean {
  const nodes: { node: Text; start: number }[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: text.length });
    text += (n as Text).data;
  }
  const at = locate(text, quote, revision);
  if (!at) return false;
  const point = (offset: number, isEnd: boolean) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const { node, start } = nodes[i];
      if (isEnd ? start < offset : start <= offset) return { node, offset: offset - start };
    }
    return { node: nodes[0].node, offset: 0 };
  };
  const from = point(at[0], false);
  const to = point(at[1], true);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);

  root.focus();
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  if (!document.execCommand("insertText", false, revision.trim())) {
    range.deleteContents();
    range.insertNode(document.createTextNode(revision.trim()));
  }
  return true;
}
