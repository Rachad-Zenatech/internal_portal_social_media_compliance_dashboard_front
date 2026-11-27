import FormattedCaptionPreview from "./FormattedCaptionPreview";
import { CaptionComparison } from "@/components/compliance/screener/CaptionComparison";
import type { IncomingTextChange } from "@/lib/creatorReviewUpdates";

export default function IncomingTextComparison({ change }: { change: IncomingTextChange }) {
  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section aria-label="Your original text" className="min-w-0 rounded-xl border p-4">
          <h4 className="mb-3 font-semibold">Your original text</h4>
          <FormattedCaptionPreview allowLegacyTextContent html={change.beforeHtml} parts={[{ text: change.before, tone: "" }]} />
        </section>
        <section aria-label="Incoming reviewer text" className="min-w-0 rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:bg-blue-500/5">
          <h4 className="mb-3 font-semibold">Incoming reviewer text</h4>
          <FormattedCaptionPreview allowLegacyTextContent html={change.afterHtml} parts={[{ text: change.after, tone: "" }]} />
        </section>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-semibold">See highlighted changes</summary>
        <div className="mt-3"><CaptionComparison before={change.before} after={change.after} subject="post text" /></div>
      </details>
    </div>
  );
}
