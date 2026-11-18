import { AlertCircle, Check, ChevronDown, Info } from "lucide-react";
import type { ContextCard, ContextFeedback } from "@/lib/contextFeedback";

function FeedbackPoint({ item }: { item: ContextFeedback }) {
  const evidenceLabel = ["VISUAL", "OBSERVED_VISUAL"].includes(item.evidenceType ?? "") ? "In the visual" : ["AUDIO", "OBSERVED_AUDIO"].includes(item.evidenceType ?? "") ? "In the audio" : "On your post";
  const action = item.improvement?.trim();
  const sourceUrl = item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) ? item.sourceUrl : undefined;
  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed">
      <h4 className="font-semibold text-foreground">{item.title}</h4>
      {item.evidence && <div className="rounded-lg bg-muted/50 px-3 py-2"><p className="mb-1 text-[11px] font-medium text-muted-foreground">{evidenceLabel}</p><p className="break-words text-foreground">{item.evidence}</p></div>}
      {item.reason && <p className="text-muted-foreground">{item.reason}</p>}
      {item.rule && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Guidance: </span>{item.rule}</p>}
      {action && <div className="border-l-2 border-primary/40 pl-3"><p className="font-semibold text-foreground">How to improve</p><p className="mt-1 break-words text-foreground">{action}</p></div>}
      {item.attention && !action && <p className="text-xs text-muted-foreground">This run did not include a specific edit. Check again for an actionable suggestion.</p>}
      {item.reference && <p className="text-[11px] text-muted-foreground">Based on: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">{item.reference}</a> : item.reference}</p>}
    </div>
  );
}

function FeedbackCard({ card, order }: { card: ContextCard; order: string }) {
  const [lead, ...remaining] = card.items;
  const attentionCount = card.items.filter((item) => item.attention).length;
  const Icon = card.status === "attention" ? AlertCircle : card.status === "good" ? Check : Info;
  const statusClass = card.status === "attention" ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" : "bg-muted text-muted-foreground";
  const moreLabel = remaining.length ? `${remaining.length} more ${remaining.length === 1 ? "detail" : "details"}` : "";
  return (
    <section aria-label={card.title} className={`flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5 ${order}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${statusClass}`}><Icon aria-hidden="true" className="size-3.5" />{card.label}</span>
      </header>
      {lead ? <FeedbackPoint item={lead} /> : <p className="text-[13px] leading-relaxed text-muted-foreground">{card.empty}</p>}
      {remaining.length > 0 && <details className="group mt-auto border-t border-border/60 pt-3">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">{moreLabel}{attentionCount > 1 && <span className="text-muted-foreground">({attentionCount - 1} more to check)</span>}<ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-4 space-y-4 divide-y divide-border/60">{remaining.map((item, index) => <div key={index} className="pt-3 first:pt-0"><FeedbackPoint item={item} /></div>)}</div>
      </details>}
    </section>
  );
}

type PositionedCard = { card: ContextCard; order: string };

function FeedbackColumn({ items }: { items: PositionedCard[] }) {
  return <div className="contents @xl:flex @xl:min-w-0 @xl:flex-1 @xl:flex-col @xl:gap-4">{items.map(({ card, order }) => <FeedbackCard key={card.key} card={card} order={order} />)}</div>;
}

export default function ContextFeedbackCards({ cards }: { cards: ContextCard[] }) {
  const orderClasses = ["order-1", "order-2", "order-3", "order-4"];
  const positioned = cards.map((card, index) => ({ card, order: orderClasses[index] ?? "order-none" }));
  const left = positioned.filter((_, index) => index % 2 === 0);
  const right = positioned.filter((_, index) => index % 2 === 1);
  return (
    <div className="@container w-full min-w-0 flex-1">
      <div className="flex flex-wrap items-start gap-4"><FeedbackColumn items={left} /><FeedbackColumn items={right} /></div>
    </div>
  );
}
