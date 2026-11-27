import { Button } from "@/components/ui/button";

export default function PendingCheckNotice({ pending, failed, requestedAt, onRetry }: {
  pending: boolean; failed: boolean; requestedAt?: string; onRetry: () => void;
}) {
  const delayed = Boolean(requestedAt && Date.now() - Date.parse(requestedAt) > 180_000);
  if (!pending || (!failed && !delayed)) return null;
  const title = failed ? "We couldn't refresh this check" : "This check is taking longer than expected";
  const detail = failed ? "You're seeing the last saved status. We'll keep trying to get an update."
    : "A completed result hasn't arrived yet. Refresh the status, or use Check again to start a new check.";
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
    <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs">{detail}</p></div>
    <Button type="button" size="sm" variant="outline" onClick={onRetry}>Refresh status</Button>
  </div>;
}
