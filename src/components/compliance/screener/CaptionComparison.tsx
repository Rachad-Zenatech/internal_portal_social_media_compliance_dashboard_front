import { captionDiff, type CaptionDiffPart } from "@/lib/captionChanges";

function ComparisonText({ parts, removed }: { parts: CaptionDiffPart[]; removed?: boolean }) {
  const content = parts.map((part, index) => {
    if (!part.changed) return <span key={index}>{part.text}</span>;
    return removed ? <del key={index} className="rounded-sm bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100">{part.text}</del>
      : <ins key={index} className="rounded-sm bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100">{part.text}</ins>;
  });
  return <p className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{content}</p>;
}

export function CaptionComparison({ before, after }: { before: string; after: string }) {
  const diff = captionDiff(before, after);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{diff.formattingOnly ? "Only spacing or line breaks changed. The wording is unchanged." : "Red shows removed wording. Green shows added wording."}</p>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <section aria-label="Caption before changes" className="min-w-0 overflow-hidden rounded-xl border">
          <h4 className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">Previous caption</h4>
          <div className="p-4"><ComparisonText parts={diff.before} removed />{!before && <p className="text-sm text-muted-foreground">No caption</p>}</div>
        </section>
        <section aria-label="Caption after changes" className="min-w-0 overflow-hidden rounded-xl border">
          <h4 className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">Updated caption</h4>
          <div className="p-4"><ComparisonText parts={diff.after} />{!after && <p className="text-sm text-muted-foreground">No caption</p>}</div>
        </section>
      </div>
    </div>
  );
}
