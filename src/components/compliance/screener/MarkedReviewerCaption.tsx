import { useMemo, type MouseEvent } from "react";
import { captionPreviewHtml, type CaptionPart } from "@/lib/captionPreviewHtml";
import type { MarkedCaptionTerm } from "@/types/captionReview";

const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Show saved caption paragraphs and lists, retaining clickable rule highlights. */
export default function MarkedReviewerCaption({ text, html, terms, picked, onFlag, onComment }: {
  text: string; html?: string | null; terms: MarkedCaptionTerm[]; picked: string | null;
  onFlag: (ruleId: string) => void; onComment: () => void;
}) {
  const parts = useMemo(() => {
    const byTerm = new Map(terms.filter((item) => picked && item.ruleId === picked && item.term.trim()).map((item) => [item.term.toLowerCase(), item]));
    const pieces = byTerm.size ? text.split(new RegExp(`(${[...byTerm.keys()].sort((a, b) => b.length - a.length).map(escapePattern).join("|")})`, "gi")) : [text];
    return pieces.map((part, index): CaptionPart => {
      const hit = index % 2 ? byTerm.get(part.toLowerCase()) : undefined;
      return { text: part, tone: hit ? (picked === hit.ruleId ? "chosen" : "flag") : "", ruleId: hit?.ruleId, dismissed: hit?.dismissed };
    });
  }, [text, terms, picked]);
  const formatted = useMemo(() => captionPreviewHtml(html ?? undefined, parts, { allowLegacyTextContent: true }), [html, parts]);
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    const ruleId = target?.closest<HTMLElement>("mark[data-rule-id]")?.dataset.ruleId;
    if (ruleId) onFlag(ruleId);
    else if (!target?.closest("a")) onComment();
  };
  const plain = parts.map((part, index) => part.ruleId
    ? <mark key={index} data-rule-id={part.ruleId} title={part.dismissed ? "Dismissed: click to see why" : "Click to see the flag"} className={`cursor-pointer rounded px-0.5 text-foreground ${part.dismissed ? "border-b-2 border-dashed border-violet-500 bg-violet-200/60 dark:bg-violet-500/30" : "bg-amber-200/70 dark:bg-amber-500/30"} ${part.tone === "chosen" ? "ring-2 ring-violet-500" : ""}`}>{part.text}</mark>
    : <span key={index}>{part.text}</span>);
  if (formatted !== null) return <div onClick={onClick} className="min-w-0 whitespace-normal break-words text-sm leading-relaxed [overflow-wrap:anywhere] [&_p]:mb-3 [&_div]:mb-3 [&_p:last-child]:mb-0 [&_div:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: formatted }} />;
  return <div onClick={onClick} className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{plain}</div>;
}
