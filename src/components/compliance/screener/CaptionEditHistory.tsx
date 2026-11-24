import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaptionRevision } from "@/types/captionEdit";
import { captionDiff } from "@/lib/captionChanges";
import CaptionChangeDialog from "./CaptionChangeDialog";

function CaptionRevisionEntry({ revision }: { revision: CaptionRevision }) {
  const when = new Date(revision.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const target = revision.platform ? revision.platform.toLowerCase().replaceAll("_", " ") : "default caption";
  const { formattingOnly } = captionDiff(revision.before, revision.after);
  const change = formattingOnly ? "Spacing updated" : "Wording updated";
  const description = `${revision.actor_name} edited the ${target} on ${when}.`;
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{revision.actor_name}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><time dateTime={revision.created_at} title={new Date(revision.created_at).toLocaleString()}>{when}</time><span aria-hidden="true"> &middot; </span>{target}<span aria-hidden="true"> &middot; </span>{change}</p>
      </div>
      <CaptionChangeDialog before={revision.before} after={revision.after} description={description} />
    </li>
  );
}

export default function CaptionEditHistory({ revisions }: { revisions: CaptionRevision[] }) {
  const [showAll, setShowAll] = useState(false);
  const entries = (showAll ? revisions : revisions.slice(0, 3)).map((revision) => <CaptionRevisionEntry key={revision.id} revision={revision} />);
  if (!revisions.length) return null;
  return (
    <details className="min-w-0 border-t pt-3">
      <summary className="cursor-pointer text-sm text-muted-foreground"><span className="ml-1 inline-flex items-center gap-2 align-middle"><History className="size-4" />Edit history<span className="rounded-full bg-muted px-2 py-0.5 text-xs">{revisions.length}</span></span></summary>
      <ul className="mt-2">{entries}</ul>
      {revisions.length > 3 && <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "Show recent edits" : `Show all ${revisions.length} edits`}</Button>}
    </details>
  );
}
