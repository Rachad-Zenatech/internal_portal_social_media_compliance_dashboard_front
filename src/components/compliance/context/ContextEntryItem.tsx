import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContextEntry } from "@/types/context";

import { KindIcon } from "./KindTabs";
import type { KindInfo } from "./kinds";

/** What an entry's buttons do, and who may use them. */
export interface EntryActions {
  scopeText: (e: ContextEntry) => string;
  canEdit: (e: ContextEntry) => boolean;
  onToggle: (e: ContextEntry) => void;
  toggling: boolean;
  onEdit: (e: ContextEntry) => void;
  onRemove: (e: ContextEntry) => void;
}

const BADGE = "ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold";

/** One entry: its title and badges, what it applies to, its text and examples, and (if allowed) its buttons. */
export default function ContextEntryItem({ entry: e, info, ...actions }: { entry: ContextEntry; info: KindInfo } & EntryActions) {
  return (
    <li className={`px-4 py-3 space-y-1.5 ${e.is_active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <KindIcon info={info} size="lg" />
        <div className="min-w-0 flex-1">
          <EntryTitle entry={e} />
          <EntryMeta entry={e} scope={actions.scopeText(e)} />
        </div>
        {actions.canEdit(e) && <EntryButtons entry={e} {...actions} />}
      </div>
      <p className="text-xs text-foreground/90 whitespace-pre-wrap">{e.body}</p>
      <EntryExamples entry={e} />
    </li>
  );
}

function EntryTitle({ entry: e }: { entry: ContextEntry }) {
  return (
    <p className="text-sm font-semibold text-foreground">
      {e.title}
      {!e.is_active && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(off)</span>}
      {e.is_policy && (
        <span
          className={`${BADGE} bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200`}
          title="Kept up to date from the platform's policy pages; changed only by super admins"
        >
          content policy
        </span>
      )}
      {!e.is_policy && e.is_starter && <span className={`${BADGE} bg-muted text-muted-foreground`}>starter</span>}
      {e.auto_source === "NEWSROOM" && (
        <span className={`${BADGE} bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200`}>newsroom</span>
      )}
    </p>
  );
}

function EntryMeta({ entry: e, scope }: { entry: ContextEntry; scope: string }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      Applies to: {scope}
      {e.as_of && ` · as of ${e.as_of}`}
      {e.source_url ? (
        <>
          {" · "}
          <a href={e.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-700 hover:underline dark:text-sky-300">
            read the article <ExternalLink className="h-3 w-3" />
          </a>
        </>
      ) : (
        e.source && ` · source: ${e.source}`
      )}
    </p>
  );
}

function EntryButtons({ entry: e, onToggle, toggling, onEdit, onRemove }: { entry: ContextEntry } & EntryActions) {
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onToggle(e)} disabled={toggling}>
        {e.is_active ? "Turn off" : "Turn on"}
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onEdit(e)}>
        <Pencil className="w-3.5 h-3.5" /> Edit
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-red-600" onClick={() => onRemove(e)} aria-label={`Remove ${e.title}`}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function EntryExamples({ entry: e }: { entry: ContextEntry }) {
  if (!e.do_examples && !e.dont_examples) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
      {e.do_examples && (
        <p className="rounded-md bg-emerald-500/5 px-2 py-1.5 text-emerald-900 dark:text-emerald-100">
          <span className="font-semibold">Works well: </span>
          {e.do_examples}
        </p>
      )}
      {e.dont_examples && (
        <p className="rounded-md bg-red-500/5 px-2 py-1.5 text-red-900 dark:text-red-100">
          <span className="font-semibold">Avoid: </span>
          {e.dont_examples}
        </p>
      )}
    </div>
  );
}
