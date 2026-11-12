import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The page numbers to show: the first, the last, and the ones around the current page, with gaps as null. */
function pageNumbers(page: number, count: number): (number | null)[] {
  const keep = new Set([0, count - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/** "26–50 of 132 posts" with previous, page numbers and next. Hidden when everything fits on one page. */
export default function ListPager({
  page,
  pageCount,
  pageSize,
  total,
  noun = "items",
  onPage,
  compact = false,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  noun?: string;
  onPage: (page: number) => void;
  /** A narrow list (a side panel): just the range and the arrows. */
  compact?: boolean;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav aria-label="Pages" className={cn("flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground", className)}>
      <span className="tabular-nums">
        {from}–{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {!compact &&
          pageNumbers(page, pageCount).map((p, i) =>
            p == null ? (
              <span key={`gap-${i}`} className="px-1">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={p === page ? "default" : "ghost"}
                aria-current={p === page ? "page" : undefined}
                className="h-7 min-w-7 px-2 text-xs tabular-nums"
                onClick={() => onPage(p)}
              >
                {p + 1}
              </Button>
            )
          )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </nav>
  );
}
