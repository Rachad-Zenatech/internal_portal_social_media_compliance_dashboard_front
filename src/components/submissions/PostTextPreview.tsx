import ScriptDocumentPreview from "@/components/script/ScriptDocumentPreview";
import FormattedCaptionPreview from "@/components/submissions/FormattedCaptionPreview";

interface Props {
  scriptText: string;
  captionParts: { text: string; tone: string }[];
  terms: string[];
  captionHtml?: string;
}

/** A formatted script document, or the post's caption with its flagged words marked. */
export default function PostTextPreview({ scriptText, captionParts, terms, captionHtml }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-t border-border/60 pt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{scriptText ? "Script" : "Caption"}</span>
      {scriptText ? (
        <ScriptDocumentPreview text={scriptText} terms={terms} />
      ) : (
        <FormattedCaptionPreview html={captionHtml} parts={captionParts} />
      )}
    </div>
  );
}
