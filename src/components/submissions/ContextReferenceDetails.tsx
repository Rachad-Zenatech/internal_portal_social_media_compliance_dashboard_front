import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ContextUse } from "@/types/sentiment";

function ContextReference({ entry }: { entry: ContextUse }) {
  const href = entry.source_url || (entry.source?.startsWith("https://") || entry.source?.startsWith("http://") ? entry.source : undefined);
  const status = entry.status === "USED" ? "Used" : entry.status === "USED_OLD" ? "May be out of date" : "Not applicable";
  const scope = entry.applies_to.map((value) => value.replaceAll("_", " ")).join(", ") || "All posts";
  const metadata = [entry.kind.toLowerCase().replaceAll("_", " "), scope, entry.as_of ? `As of ${entry.as_of.slice(0, 10)}` : null].filter(Boolean).join(" ? ");
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3 text-[13px]">
      <div className="min-w-0 flex-1"><p className="font-medium text-foreground">{entry.title}</p><p className="mt-1 text-xs text-muted-foreground">{metadata}</p>{entry.note && <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>}{!href && entry.source && <p className="mt-1 text-xs text-muted-foreground">{entry.source}</p>}{href && <a href={href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">Open source</a>}</div>
      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{status}</span>
    </li>
  );
}

export default function ContextReferenceDetails({ entries, gaps }: { entries: ContextUse[]; gaps: string[] }) {
  const [all, setAll] = useState(false);
  const visible = all ? entries : entries.slice(0, 8);
  const toggle = () => setAll((value) => !value);
  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-foreground">Messaging context used</h3><Link to="/compliance/context" className="text-xs font-medium text-primary underline">Manage context</Link></div>
      {gaps.length > 0 && <div className="mt-3 rounded-lg bg-muted/50 p-3"><h4 className="text-xs font-semibold text-foreground">Missing guidance</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-muted-foreground">{gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div>}
      <ul className="mt-2 divide-y divide-border/60">{visible.map((entry) => <ContextReference key={entry.id} entry={entry} />)}</ul>
      {!entries.length && <p className="mt-3 text-[13px] text-muted-foreground">No messaging-context entries were recorded for this run.</p>}
      {entries.length > 8 && <Button variant="ghost" size="sm" className="mt-2" onClick={toggle}>{all ? "Show fewer" : `Show all ${entries.length} entries`}</Button>}
    </section>
  );
}
