import { useMemo } from "react";
import { captionPreviewHtml, type CaptionPart } from "@/lib/captionPreviewHtml";

/** Preserve editor paragraphs, emphasis and links without treating HTML source wrapping as line breaks. */
export default function FormattedCaptionPreview({ html, parts }: { html?: string; parts: CaptionPart[] }) {
  const formatted = useMemo(() => captionPreviewHtml(html, parts), [html, parts]);
  const plain = parts.map((part, index) => {
    if (!part.tone) return <span key={index}>{part.text}</span>;
    const color = part.tone === "chosen" ? "bg-red-200 ring-2 ring-red-500 dark:bg-red-500/40" : "bg-amber-200/70 dark:bg-amber-500/30";
    return <mark key={index} className={`rounded px-0.5 text-foreground ${color}`}>{part.text}</mark>;
  });
  if (formatted != null) return <div className="min-w-0 whitespace-normal break-words text-[13px] leading-relaxed text-foreground/90 [&_p]:mb-3 [&_div]:mb-3 [&_p:last-child]:mb-0 [&_div:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: formatted }} />;
  return <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">{plain}</p>;
}
