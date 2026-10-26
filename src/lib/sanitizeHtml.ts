/**
 * Caption HTML sanitizer for the rich-text editor: keeps only the formatting the editor produces and drops
 * everything else (scripts, event handlers, styles, javascript: links). The server sanitizes too; this protects
 * against captions saved before it did, and against pasted HTML before it's saved.
 *
 * Parses in an inert document (DOMParser runs no scripts and loads no images), then rebuilds an allowlisted copy.
 */

const ALLOWED_TAGS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "A", "SPAN"]);
// Whose content is dropped entirely, not kept as text.
const DROP_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "HEAD", "TITLE"]);

/** A link the editor may keep: http(s) or mailto only. */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  // Browsers ignore control characters and whitespace inside a scheme ("java\tscript:"), so check without them.
  // eslint-disable-next-line no-control-regex
  const compact = value.trim().replace(/[\u0000- \u007f]/g, "").toLowerCase();
  return /^(https?:\/\/|mailto:)/.test(compact) ? value.trim() : null;
}

function copyClean(from: Node, to: Node, doc: Document) {
  from.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      to.appendChild(doc.createTextNode(node.textContent ?? ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (DROP_CONTENT.has(tag)) return;
    if (!ALLOWED_TAGS.has(tag)) {
      // Unknown wrapper: keep its text and allowed children.
      copyClean(el, to, doc);
      return;
    }
    const clean = doc.createElement(tag.toLowerCase());
    if (tag === "A") {
      const href = safeHref(el.getAttribute("href"));
      if (href) {
        clean.setAttribute("href", href);
        clean.setAttribute("rel", "noopener noreferrer");
        clean.setAttribute("target", "_blank");
      }
    }
    copyClean(el, clean, doc);
    to.appendChild(clean);
  });
}

/** The HTML with only safe formatting left, as a string for innerHTML or insertHTML. */
export function sanitizeCaptionHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = document.implementation.createHTMLDocument("");
  const container = out.createElement("div");
  copyClean(parsed.body, container, out);
  return container.innerHTML;
}
