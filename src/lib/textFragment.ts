/**
 * A link that opens a page scrolled to (and highlighting) a piece of its text: a URL text fragment, `#:~:text=start,end`.
 * Chrome, Edge and Safari follow it; other browsers just open the page.
 */

/** Characters a text fragment can't hold as they are ("-", "," and "&" separate its parts). */
function encodePart(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C").replace(/&/g, "%26");
}

/**
 * The page's address with a text fragment for the quote, or the plain address when there is no quote. A long quote is
 * matched by its first and last few words, so a small difference in the middle (a line break, a footnote mark) doesn't
 * stop the browser finding it.
 */
export function textFragmentUrl(url: string, quote?: string | null): string {
  const words = (quote ?? "").replace(/[“”"]/g, " ").split(/\s+/).filter(Boolean);
  if (!url || words.length === 0) return url;
  const base = url.split("#")[0];
  if (words.length <= 10) return `${base}#:~:text=${encodePart(words.join(" "))}`;
  const start = words.slice(0, 6).join(" ");
  const end = words.slice(-4).join(" ").replace(/[.,;:!?)]+$/, "");
  return `${base}#:~:text=${encodePart(start)},${encodePart(end)}`;
}
