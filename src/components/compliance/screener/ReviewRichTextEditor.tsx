import { useId, type ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useReviewRichTextEditor } from "@/hooks/useReviewRichTextEditor";
import { sanitizeCaptionHtml } from "@/lib/sanitizeHtml";
import type { ReviewTextValue } from "@/lib/reviewText";

interface Props { value: ReviewTextValue; onChange: (value: ReviewTextValue) => void; disabled?: boolean; label?: string; }
const commands = [{ command: "bold", label: "Bold", text: "B" }, { command: "italic", label: "Italic", text: "I" },
  { command: "underline", label: "Underline", text: "U" }, { command: "insertUnorderedList", label: "Bullet list", text: "Bullets" },
  { command: "insertOrderedList", label: "Numbered list", text: "Numbered list" }];

/** Review the actual formatted caption, preserving links, emphasis and whitespace while editing. */
export default function ReviewRichTextEditor({ value, onChange, disabled = false, label = "Edit text" }: Props) {
  const id = useId();
  const state = useReviewRichTextEditor(value, onChange);
  const toolbar = commands.map(item => <Button key={item.command} type="button" size="sm" variant="ghost" disabled={disabled}
    aria-label={item.label} title={item.label} onMouseDown={event => event.preventDefault()} onClick={() => state.format(item.command)}>{item.text}</Button>);
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    state.format(html ? "insertHTML" : "insertText", html ? sanitizeCaptionHtml(html) : event.clipboardData.getData("text/plain"));
  };
  return (
    <div className="space-y-2">
      <label id={id} className="text-sm font-medium">{label}</label>
      <div className="overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        <div role="toolbar" aria-label="Text formatting" className="flex flex-wrap items-center border-b p-1">
          {toolbar}<Button type="button" size="sm" variant="ghost" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={state.link}>Link</Button>
        </div>
        <div ref={state.editor} role="textbox" aria-labelledby={id} aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled}
          suppressContentEditableWarning onInput={state.emit} onMouseUp={state.remember} onKeyUp={state.remember} onPaste={paste}
          className="min-h-48 whitespace-normal break-words p-3 text-sm leading-relaxed outline-none [&_p]:mb-3 [&_div]:mb-3 [&_p:last-child]:mb-0 [&_div:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline" />
      </div>
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
