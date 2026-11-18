import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Link } from "react-router-dom";

import type { XTrendOpportunity } from "@/types/publicMood";

function TermList({ label, items, mono = false }: { label: string; items: string[]; mono?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium text-foreground/80">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className={`rounded bg-muted px-1.5 py-0.5 text-[10px] ${mono ? "font-mono" : ""}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dropdown showing what the scraper searched for to find this topic's items, and a quick open of the source post. */
export default function SearchDetails({ trend }: { trend: XTrendOpportunity }) {
  const [open, setOpen] = useState(false);
  const keywords = trend.search_keywords ?? [];
  const queries = trend.search_queries ?? [];
  if (!trend.search_method && keywords.length === 0 && queries.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground hover:text-foreground"
      >
        <Search className="h-3 w-3" />
        <span className="flex-1 text-left">How this was found</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/70 px-2.5 py-2 text-muted-foreground">
          {trend.search_method && <p>{trend.search_method}</p>}
          <TermList label="Keywords" items={keywords} />
          <TermList label="Search queries" items={queries} mono />
          {trend.post_id && (
            <Link to={`/submissions/${trend.post_id}`} className="inline-block font-medium text-blue-600 hover:underline dark:text-blue-400">
              Quick open the post
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
