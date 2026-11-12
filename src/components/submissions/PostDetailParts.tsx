import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Loader2, type ShieldCheck } from "lucide-react";

import { submissionService } from "@/services/submissionService";

export function HistoryView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["submission-history", id],
    queryFn: () => submissionService.history(id),
    staleTime: 0,
  });
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history...
      </p>
    );
  }
  const events = data?.events ?? [];
  if (!events.length) return <p className="text-xs text-muted-foreground">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((e) => (
        <li key={e.id} className="text-xs">
          <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-blue-500" />
          <p className="font-medium text-foreground">{e.message}</p>
          <p className="text-muted-foreground">
            {e.actor_name ? `${e.actor_name} · ` : ""}
            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** One of the two analysis cards: what it checks, its result so far, and a way to open or run it. */
export function CheckCard({
  icon: Icon,
  title,
  status,
  statusTone = "text-muted-foreground",
  description,
  action,
  onAction,
  busy = false,
}: {
  icon: typeof ShieldCheck;
  title: string;
  status: string;
  statusTone?: string;
  description: string;
  action?: string | null;
  onAction?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="w-4 h-4 text-blue-700 dark:text-blue-300" /> {title}
        </p>
        <span className={`text-[11px] font-semibold ${statusTone}`}>{status}</span>
      </div>
      <p className="mt-2 flex-1 text-xs text-muted-foreground">{description}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">Supports human review</span>
        {action && (
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline disabled:opacity-60 dark:text-blue-300"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />} {action} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
