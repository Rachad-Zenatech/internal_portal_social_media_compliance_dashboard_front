import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Cards in a row that slides: arrows move a screenful at a time, the dots show where you are and jump there, and the
 * row can be swiped or scrolled sideways too. Each card snaps into place.
 */
export default function ReviewSlideshow({ slides, label }: { slides: { key: string; node: ReactNode }[]; label: string }) {
  const track = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  // Where the row is: which "screen" of cards shows, and whether it can move either way.
  const measure = () => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // A little leeway: cards snap with the row's padding, so the start can sit a few pixels in.
    setAtStart(el.scrollLeft <= 20);
    setAtEnd(el.scrollLeft >= max - 4);
    const count = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05));
    setPages(count);
    setPage(max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (count - 1)));
  };
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Opens on the first card, fully in view.
    el.scrollLeft = 0;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [slides.length]);

  const go = (dir: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };
  const jump = (p: number) => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: pages <= 1 ? 0 : (max * p) / (pages - 1), behavior: "smooth" });
  };

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="relative">
        <ul
          ref={track}
          onScroll={measure}
          className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s) => (
            <li key={s.key} className="w-[260px] shrink-0 snap-start sm:w-[280px] min-[112.5rem]:w-[320px]">
              {s.node}
            </li>
          ))}
        </ul>

        {/* Fades at the edges hint that there is more */}
        {!atStart && <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />}
        {!atEnd && <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />}

        {/* The arrows sit on either side of the row, halfway down; each shows only when there is more that way. */}
        {!atStart && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-card shadow-md"
            onClick={() => go(-1)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {!atEnd && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full bg-card shadow-md"
            onClick={() => go(1)}
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center px-4 pb-3 pt-2">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => jump(i)}
                className={`h-2 rounded-full transition-all ${i === page ? "w-6 bg-blue-600" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
