import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, isPast } from "date-fns";
import { CheckCircle2, FileText, MessageSquare, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DeadlinePill, Loading, Section, StatCard, greeting } from "@/components/dashboard/dashboardParts";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useAuth } from "@/lib/AuthContext";
import { scriptBatchService } from "@/services/scriptBatchService";
import { scriptService } from "@/services/scriptService";
import type { SuggesterItem } from "@/types/script";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 8;

const touched = (i: SuggesterItem) => i.my_comments > 0 || Boolean(i.my_suggestion_at);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What they have done on an item so far, as a short chip. */
function Progress({ item }: { item: SuggesterItem }) {
  const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";
  if (item.my_suggestion_at)
    return (
      <span className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`}>
        <PencilLine className="h-3 w-3" /> Suggestion saved
      </span>
    );
  if (item.my_comments > 0)
    return (
      <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`}>
        <MessageSquare className="h-3 w-3" /> {plural(item.my_comments, "comment")}
      </span>
    );
  return <span className={`${base} bg-muted text-muted-foreground`}>Not started</span>;
}

/**
 * A suggesting reviewer's dashboard: what was sent to them by name and is still in review, and what they have done on it.
 * They can read, comment and suggest script edits, so there are no approval, score or scheduling numbers here.
 */
export default function SuggesterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setActiveVideoId } = useVideoUploadQueue();
  const now = useMemo(() => new Date(), []);

  const dash = useQuery({ queryKey: ["suggester-dashboard"], queryFn: scriptService.suggesterDashboard, staleTime: 0 });
  const batches = useQuery({ queryKey: ["script-batches", "review"], queryFn: () => scriptBatchService.list("review"), staleTime: 0 });

  const items = useMemo(() => dash.data?.items ?? [], [dash.data]);
  const recent = dash.data?.recent ?? [];
  const loading = dash.isLoading;

  const waiting = items.filter((i) => !touched(i)).length;
  const dueSoon = items.filter((i) => i.due_at && !isPast(new Date(i.due_at)) && new Date(i.due_at).getTime() - now.getTime() <= 3 * DAY_MS).length;
  const overdue = items.filter((i) => i.due_at && isPast(new Date(i.due_at))).length;
  const inProgress = items.filter((i) => i.my_suggestion_at).length;

  const shown = items.slice(0, LIST_LIMIT);
  const scriptIds = useMemo(() => new Set(items.filter((i) => i.kind === "script").map((i) => i.id)), [items]);

  // Batches they are attached to, with how many of its scripts they have looked at.
  const batchRows = useMemo(() => {
    const byBatch = new Map<string, SuggesterItem[]>();
    for (const i of items) if (i.batch_id) byBatch.set(i.batch_id, [...(byBatch.get(i.batch_id) ?? []), i]);
    return [...byBatch.entries()].map(([id, list]) => ({
      id,
      title: batches.data?.find((b) => b.id === id)?.title ?? "Script batch",
      total: list.length,
      done: list.filter(touched).length,
      first: list.find((i) => !touched(i)) ?? list[0],
    }));
  }, [items, batches.data]);

  const open = (i: SuggesterItem) => {
    if (i.kind === "script") return navigate(`/script-review/scripts/${i.id}`);
    setActiveVideoId(`sub-${i.id}`);
    navigate("/compliance/scanner");
  };

  const headline = loading
    ? ""
    : items.length === 0
    ? "Nothing has been sent to you for suggestions."
    : `${plural(items.length, "item")} sent to you${waiting ? `, ${waiting} you haven't started` : ""}.${overdue ? ` ${overdue} past ${overdue === 1 ? "its" : "their"} deadline.` : ""}`;

  return (
    <div data-canvas="contrast" className="mx-auto w-full max-w-[1400px] space-y-6 pb-8 animate-in fade-in duration-300 min-[112.5rem]:max-w-[2200px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {greeting(now)}
            {user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
        </div>
        <Button
          className="h-10 rounded-lg bg-blue-700 px-4 font-medium text-white hover:bg-blue-800"
          onClick={() => {
            const next = items.find((i) => !touched(i)) ?? items[0];
            if (next) open(next);
            else navigate("/script-review");
          }}
        >
          {items.length ? "Start suggesting" : "Open Script review"}
        </Button>
      </div>

      <section aria-label="Your suggestions at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Waiting on you" value={loading ? "–" : waiting} note={waiting ? "Nothing added yet" : "All started"} />
        <StatCard
          label="Due in 3 days"
          value={loading ? "–" : dueSoon}
          note={overdue ? `${overdue} already past due` : dueSoon ? "Soonest first below" : "Nothing close"}
          noteTone={overdue ? "red" : dueSoon ? "amber" : "green"}
        />
        <StatCard label="Suggestions in progress" value={loading ? "–" : inProgress} note="Saved, visible only to you for now" />
        <StatCard label="Sent to you" value={loading ? "–" : items.length} note="Posts and scripts in review" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px] min-[112.5rem]:grid-cols-[minmax(0,1fr)_480px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Needs your input"
            count={loading || !items.length ? undefined : items.length}
            subtitle="Soonest deadline first"
            action={
              <Link to="/script-review" className="shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                View all
              </Link>
            }
          >
            {loading ? (
              <Loading />
            ) : items.length === 0 ? (
              <div className="border-t border-border/60 px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">All caught up</p>
                <p className="text-xs text-muted-foreground">Posts and scripts sent to you will show up here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-border/60">
                <table className="w-full min-w-[640px] table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[140px]" />
                    <col className="w-[170px]" />
                    <col className="w-[104px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pl-4 pr-3 font-semibold">Post</th>
                      <th className="px-3 py-2 font-semibold">Deadline</th>
                      <th className="px-3 py-2 font-semibold">Your progress</th>
                      <th className="py-2 pl-3 pr-4 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((i) => (
                      <tr key={i.id} className="border-t border-border/60 transition-colors hover:bg-muted/30">
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-14 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <FileText className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <button type="button" onClick={() => open(i)} className="block max-w-full truncate text-left font-semibold text-foreground hover:underline">
                                {i.title}
                              </button>
                              <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                <span className="rounded bg-blue-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                  {i.kind === "script" ? "Script" : "Post"}
                                </span>
                                <span>
                                  by {i.creator_name ?? "Unknown"}
                                  {i.sent_at && ` · sent ${formatDistanceToNow(new Date(i.sent_at))} ago`}
                                </span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <DeadlinePill dueAt={i.due_at} />
                        </td>
                        <td className="px-3 py-3">
                          <Progress item={i} />
                        </td>
                        <td className="py-3 pl-3 pr-4">
                          <div className="flex justify-end">
                            <Button size="sm" className="h-8 rounded-lg bg-blue-700 px-3.5 text-xs font-medium text-white hover:bg-blue-800" onClick={() => open(i)}>
                              Open
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length > shown.length && (
                  <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                    Showing {shown.length} of {items.length}.{" "}
                    <Link to="/script-review" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      See everything
                    </Link>
                  </p>
                )}
              </div>
            )}
          </Section>

          {batchRows.length > 0 && (
            <Section title="Script batches" subtitle="Batches with scripts sent to you">
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {batchRows.map((b) => (
                  <li key={b.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/script-review/${b.id}`} className="block truncate text-sm font-semibold text-foreground hover:underline">
                        {b.title}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${b.done} of ${b.total} scripts started`}>
                          <span className="block h-full bg-blue-600" style={{ width: `${(b.done / b.total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {b.done} of {plural(b.total, "script")} started
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-lg px-3.5 text-xs font-medium" onClick={() => open(b.first)}>
                      {b.done < b.total ? "Next script" : "Open"}
                    </Button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Your recent activity" subtitle="Comments and suggestions you made">
            {loading ? (
              <Loading />
            ) : recent.length === 0 ? (
              <p className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">Nothing yet. Open something sent to you to get started.</p>
            ) : (
              <ul className="divide-y divide-border/60 border-t border-border/60">
                {recent.map((a, n) => {
                  const Icon = a.kind === "comment" ? MessageSquare : PencilLine;
                  return (
                    <li key={`${a.kind}-${a.submission_id}-${n}`}>
                      <Link to={scriptIds.has(a.submission_id) ? `/script-review/scripts/${a.submission_id}` : `/submissions/${a.submission_id}`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {a.kind === "comment" ? "You commented on " : "You saved a suggestion on "}
                            <span className="font-semibold">{a.title}</span>
                          </p>
                          {a.snippet && <p className="truncate text-xs text-muted-foreground">&ldquo;{a.snippet}&rdquo;</p>}
                          <p className="text-[11px] text-muted-foreground">
                            {a.reference_code} · {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
