import type { ReactNode } from "react";
import { ChevronDown, ImageIcon, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import ContextFeedbackCards from "@/components/submissions/ContextFeedbackCards";
import ContextReferenceDetails from "@/components/submissions/ContextReferenceDetails";
import { contextFeedbackCards } from "@/lib/contextFeedback";
import type { ContextUse, SentimentFinding, SentimentResult } from "@/types/sentiment";

type Report = NonNullable<SentimentResult["context_report"]>;

function CaptionVisualComparison({ visual }: { visual?: SentimentResult["visual_alignment"] }) {
  if (!visual) return null;
  const verdict = visual.verdict === "ALIGNED" ? "Matches the captions" : visual.verdict === "PARTIAL" ? "Partly matches" : "Doesn't match";
  const pill = visual.verdict === "ALIGNED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : visual.verdict === "PARTIAL" ? "bg-amber-500/10 text-amber-800 dark:text-amber-200" : "bg-red-500/10 text-red-700 dark:text-red-300";
  return (
    <section aria-label="Graphic vs captions" className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Graphic</p><h3 className="text-base font-bold text-foreground">Graphic vs captions</h3></div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill}`}>{verdict}</span>
      </header>
      <p className="flex gap-2 text-[13px] text-foreground/80"><ImageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky-600" />{visual.explanation}</p>
      {visual.mismatches.length > 0 && <ul className="ml-6 flex flex-col gap-1">{visual.mismatches.map((point) => <li key={point} className="flex gap-2 text-[13px] text-foreground"><XCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-red-600" />{point}</li>)}</ul>}
    </section>
  );
}

/** Keep the post beside three actionable context checks, with supporting material below. */
export default function ContextReportView({ report, entries, post, findings = [], details, visual }: {
  report?: Report | null;
  entries: ContextUse[];
  post?: ReactNode;
  findings?: SentimentFinding[];
  details?: ReactNode;
  visual?: SentimentResult["visual_alignment"];
}) {
  const cards = report ? contextFeedbackCards(report, findings) : [];
  const layout = post ? "flex flex-col items-start gap-4 xl:flex-row" : "space-y-4";
  return (
    <section className="space-y-4" aria-label="Messaging context feedback">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-foreground">Messaging context fit</h2><p className="mt-1 text-[13px] text-muted-foreground">Check what needs attention and how to improve it. Each note refers to this post.</p></div>
        <Link to="/compliance/context" className="rounded-md text-xs font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-ring">Open messaging context</Link>
      </header>
      <div className={layout}>
        {post && <div className="w-full min-w-0 max-w-[320px] shrink-0 xl:sticky xl:top-4">{post}</div>}
        {report ? <ContextFeedbackCards cards={cards} /> : <p className="rounded-xl border border-border p-4 text-[13px] text-muted-foreground">This run has no detailed messaging-context feedback. Run the sentiment check to compare this post with your team's guidance.</p>}
      </div>
      <CaptionVisualComparison visual={visual} />
      <details className="group rounded-2xl border border-border/70 bg-muted/10 p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">More details <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-4 space-y-4"><ContextReferenceDetails entries={entries} gaps={report?.gaps ?? []} />{details}</div>
      </details>
    </section>
  );
}
