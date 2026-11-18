import { useState } from "react";
import { format } from "date-fns";
import { Clock, Globe2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNavPublicMood, useScrapeTwitter } from "@/hooks/usePublicMood";
import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import type { ScrapeScope } from "@/types/publicMood";
import NavTrackSection from "./NavTrackSection";

/** Shared social-listening nav view: Financial ZenaTech sentiment + Today's Posts public mood. */
export default function PublicMoodPage() {
  const { data, isLoading, error } = useNavPublicMood(true);
  const scrapeTwitter = useScrapeTwitter();
  const { addJob } = useGlobalProgress();
  const [activeScope, setActiveScope] = useState<ScrapeScope | null>(null);

  const runScrape = (scope: ScrapeScope) => {
    setActiveScope(scope);
    const label =
      scope === "financial"
        ? "Scrape Financial ZenaTech"
        : scope === "today"
        ? "Scrape Today's Posts"
        : "Scrape Financial ZenaTech & Today's Posts";
    const promise = scrapeTwitter.mutateAsync(scope).finally(() => setActiveScope(null));
    addJob(label, promise, {
      description: "Collecting live financial coverage for ZenaTech and public mood for today's posts...",
      type: "upload",
      link_url: "/public-mood",
    });
  };

  if (isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading public mood scrapings...
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-6xl p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-700 dark:text-red-300">
          Could not load public mood: {(error as Error | null)?.message || "Unexpected error"}
        </div>
      </main>
    );
  }

  const busy = scrapeTwitter.isPending || data.scrape_state === "running";

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            <Globe2 className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Public mood</h1>
            <p className="text-sm text-muted-foreground">
              Two live public scrapings: financial conversation about ZenaTech and public mood based on today&apos;s posts.
            </p>
            {data.schedule_label && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>{data.schedule_label}</span>
                {data.next_scrape_at && (
                  <span>· Next run: {format(new Date(data.next_scrape_at), "EEE MMM d, h:mm a")}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <Button type="button" className="gap-2" disabled={busy} onClick={() => runScrape("all")}>
          <RefreshCw className={`h-4 w-4 ${busy && activeScope === "all" ? "animate-spin" : ""}`} />
          <span>{busy ? "Scraping..." : "Scrape both"}</span>
        </Button>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <NavTrackSection
          track={data.financial_zenatech}
          scope="financial"
          scrapeLabel="Scrape financial"
          busy={busy}
          activeScope={activeScope}
          onScrape={runScrape}
        />
        <NavTrackSection
          track={data.today_posts}
          scope="today"
          scrapeLabel="Scrape today's posts"
          busy={busy}
          activeScope={activeScope}
          onScrape={runScrape}
        />
      </div>
    </main>
  );
}
