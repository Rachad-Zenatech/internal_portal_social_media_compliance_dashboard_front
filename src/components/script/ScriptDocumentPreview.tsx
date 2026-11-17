import { InlineDiff, isStructured } from "@/components/script/ScriptDiff";
import type { DiffPart } from "@/lib/wordDiff";

/** Read-only script preview using the same document renderer as the reviewer workspace. */
export default function ScriptDocumentPreview({ text, terms }: { text: string; terms: string[] }) {
  const parts: DiffPart[] = [{ kind: "same", before: text, after: text }];
  const documentClass = isStructured(parts)
    ? "mx-auto min-w-0 max-w-[1000px]"
    : "mx-auto min-w-0 max-w-[760px] rounded-xl border border-border bg-card px-6 py-7 shadow-xs";
  return (
    <div role="region" aria-label="Formatted script preview" tabIndex={0} className="max-h-[70vh] min-w-0 overflow-auto [&_table]:min-w-[720px] [&_th]:min-w-40 [&_th:first-child]:min-w-20 [&_td]:break-normal">
      <article className={documentClass}>
        <InlineDiff parts={parts} terms={terms} showChanges={false} numbered={false} />
      </article>
    </div>
  );
}
