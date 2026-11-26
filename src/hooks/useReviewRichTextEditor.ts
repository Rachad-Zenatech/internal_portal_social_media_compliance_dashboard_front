import { useLayoutEffect, useRef, useState } from "react";
import { safeHref, sanitizeCaptionHtml } from "@/lib/sanitizeHtml";
import type { ReviewTextValue } from "@/lib/reviewText";

/** Seed once without emitting a change; typing never replaces the DOM or resets the caret. */
export function useReviewRichTextEditor(value: ReviewTextValue, onChange: (value: ReviewTextValue) => void) {
  const editor = useRef<HTMLDivElement>(null);
  const initial = useRef(value);
  const selection = useRef<Range | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!editor.current) return;
    if (initial.current.html != null) editor.current.innerHTML = sanitizeCaptionHtml(initial.current.html);
    else editor.current.innerText = initial.current.text.replace(/ {2,}/g, spaces => "\u00a0".repeat(spaces.length));
  }, []);
  const remember = () => {
    const selected = window.getSelection();
    if (selected?.rangeCount && editor.current?.contains(selected.anchorNode)) selection.current = selected.getRangeAt(0).cloneRange();
  };
  const emit = () => {
    if (!editor.current) return;
    onChange({ text: editor.current.innerText.replace(/\r\n/g, "\n").replace(/\u00a0/g, " "), html: sanitizeCaptionHtml(editor.current.innerHTML) });
    remember();
  };
  const format = (command: string, argument?: string) => {
    editor.current?.focus();
    const selected = window.getSelection();
    if (selection.current && editor.current?.contains(selection.current.commonAncestorContainer)) {
      selected?.removeAllRanges(); selected?.addRange(selection.current);
    }
    document.execCommand(command, false, argument);
    emit();
  };
  const link = () => {
    const url = window.prompt("Link address (https:// or mailto:). Leave empty to remove a link.");
    if (url == null) return;
    if (!url.trim()) { setError(null); format("unlink"); return; }
    const href = safeHref(url);
    if (!href) { setError("Use a full https://, http:// or mailto: link."); return; }
    setError(null); format("createLink", href);
  };
  return { editor, remember, emit, format, link, error };
}
