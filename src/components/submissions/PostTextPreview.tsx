import ScriptDocumentPreview from "@/components/script/ScriptDocumentPreview";

interface Props {
  scriptText: string;
  captionParts: { text: string; tone: string }[];
  terms: string[];
}

/** A formatted script document, or the post's caption with its flagged words marked. */
export default function PostTextPreview({ scriptText, captionParts, terms }: Props) {
  const caption = captionParts.map((part, index) => {
    if (!part.tone) return <span key={index}>{part.text}</span>;
    const color = part.tone === "chosen" ? "bg-red-200 ring-2 ring-red-500 dark:bg-red-500/40" : "bg-amber-200/70 dark:bg-amber-500/30";
    return <mark key={index} className={`rounded px-0.5 text-foreground ${color}`}>{part.text}</mark>;
  });
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-border/60 pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{scriptText ? "Script" : "Caption"}</span>
      {scriptText ? (
        <ScriptDocumentPreview text={scriptText} terms={terms} />
      ) : (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{caption}</p>
      )}
    </div>
  );
}
