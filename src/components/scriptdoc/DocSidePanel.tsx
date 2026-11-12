import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Flag, History as HistoryIcon, Loader2, MessageSquare, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { CheckInList, Dot } from "@/components/scriptdoc/ReviewDialogs";
import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import ScriptCompliance, { activeFlagCount } from "@/components/script/ScriptCompliance";
import ScriptFindings from "@/components/script/ScriptFindings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocDetail, DocNote } from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";

export type PanelTab = "notes" | "checks" | "reviewers" | "history";

/** The box for the comment on the wording that was selected. */
function NoteComposer({ quote, onCompose, onCancel }: { quote: string; onCompose: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-md border border-blue-300 bg-blue-50 p-2 dark:border-blue-500/40 dark:bg-blue-500/10">
      <p className="mb-1 line-clamp-2 text-xs italic text-muted-foreground">“{quote}”</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write your comment" autoFocus />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!text.trim()} onClick={() => onCompose(text.trim())}>
          Comment
        </Button>
      </div>
    </div>
  );
}

/** The notes on the script, live: each person's highlights and comments in their own colour, replies, resolving. */
function NotesTab({
  notes,
  activeId,
  canNote,
  me,
  onPick,
  onReply,
  onResolve,
  onDelete,
  composer,
  onCompose,
  onCancelCompose,
}: {
  notes: DocNote[];
  activeId: string | null;
  canNote: boolean;
  me: string;
  onPick: (n: DocNote) => void;
  onReply: (id: string, text: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  composer: { quote: string } | null;
  onCompose: (text: string) => void;
  onCancelCompose: () => void;
}) {
  const [reply, setReply] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const open = notes.filter((n) => !n.resolved);
  const resolved = notes.filter((n) => n.resolved);
  const shown = showResolved ? notes : open;

  return (
    <div className="flex flex-col gap-3 p-3">
      {composer && <NoteComposer quote={composer.quote} onCompose={onCompose} onCancel={onCancelCompose} />}
      {shown.length === 0 && !composer && (
        <p className="text-sm text-muted-foreground">
          {canNote ? "Select wording in the script, then use Highlight or Comment above it." : "No notes yet."}
        </p>
      )}
      {shown.map((n) => (
        <div
          key={n.id}
          className={cn("rounded-md border-l-4 border bg-card p-2.5 text-sm", n.id === activeId && "ring-2 ring-blue-400", n.resolved && "opacity-60")}
          style={{ borderLeftColor: n.color }}
        >
          <button type="button" className="block w-full text-left" onClick={() => onPick(n)}>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Dot color={n.color} />
              <span className="font-medium text-foreground">{n.author_name}</span>
              <span>· {n.kind === "highlight" ? "highlight" : "comment"}</span>
              <span className="ml-auto">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">“{n.quote}”</p>
            {n.text && <p className="mt-1 whitespace-pre-wrap">{n.text}</p>}
          </button>
          {n.replies.map((r, i) => (
            <p key={i} className="mt-1.5 border-t pt-1.5 text-xs">
              <span className="font-medium">{r.author_name}: </span>
              {r.text}
            </p>
          ))}
          {canNote && !n.resolved && (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={reply[n.id] ?? ""}
                onChange={(e) => setReply((r) => ({ ...r, [n.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (reply[n.id] ?? "").trim()) {
                    onReply(n.id, reply[n.id].trim());
                    setReply((r) => ({ ...r, [n.id]: "" }));
                  }
                }}
                placeholder="Reply"
                className="h-7 min-w-0 flex-1 rounded border bg-background px-2 text-xs"
              />
            </div>
          )}
          {canNote && (
            <div className="mt-1.5 flex justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onResolve(n.id, !n.resolved)}>
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                {n.resolved ? "Reopen" : "Resolve"}
              </Button>
              {n.author_id === me && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => onDelete(n.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      {resolved.length > 0 && (
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowResolved((s) => !s)}>
          {showResolved ? "Hide" : "Show"} {resolved.length} resolved
        </button>
      )}
    </div>
  );
}

/** The rulebook flags on the script as it reads now, with the same finding cards a post shows. */
function ChecksTab({ doc, editor }: { doc: DocDetail; editor: React.RefObject<CollabEditorHandle | null> }) {
  const [check, setCheck] = useState<StoredCheck | null>(null);
  const run = useMutation({
    mutationFn: () => scriptDocService.check(doc.id, editor.current?.getText()),
    onSuccess: setCheck,
    onError: (e: any) => toast.error(e?.message ?? "The check couldn't run"),
  });
  const flags = activeFlagCount(check);
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {check ? "Check again" : "Check against the rulebook"}
        </Button>
        {check && <span className="text-xs text-muted-foreground">{flags} to look at</span>}
      </div>
      {check && <ScriptCompliance check={check} />}
      {check && (
        <ScriptFindings
          check={check}
          onFind={(t) => editor.current?.find(t)}
          onReplace={doc.access.can_edit ? (q, r) => editor.current?.replace(q, r) ?? false : undefined}
        />
      )}
      <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
        Sentiment and public mood read a post, so they become available when this script is attached to a post.
      </p>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: "created the script",
  SUBMITTED: "sent it for review",
  CHECKIN: "checked in",
  LEVEL2: "passed it to level 2",
  APPROVED: "approved it",
  CHANGES_REQUESTED: "asked for changes",
  CHANGE: "edited the script",
  NOTE: "added or changed notes",
};

function HistoryTab({ doc }: { doc: DocDetail }) {
  const { data, isLoading } = useQuery({ queryKey: ["script-doc-history", doc.id, doc.status, doc.round], queryFn: () => scriptDocService.history(doc.id) });
  const [open, setOpen] = useState<number | null>(null);
  if (isLoading) return <p className="p-3 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Versions</h4>
        {(data?.versions ?? []).length === 0 && <p className="text-sm text-muted-foreground">A version is kept each time the script is sent or decided.</p>}
        {data?.versions.map((v) => (
          <div key={v.id} className="mb-1.5 rounded-md border p-2 text-sm">
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === v.id ? null : v.id)}>
              <span className="font-medium">{v.label}</span>
              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
            </button>
            {open === v.id && <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{v.body_text}</pre>}
          </div>
        ))}
      </section>
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h4>
        <ul className="flex flex-col gap-1.5">
          {data?.events.map((e) => (
            <li key={e.id} className="text-xs">
              <span className="font-medium">{e.user_name ?? "Someone"}</span> {EVENT_LABEL[e.kind] ?? e.kind.toLowerCase()}
              {typeof e.detail?.note === "string" && e.detail.note ? <span className="text-muted-foreground"> — “{e.detail.note}”</span> : null}
              <span className="block text-muted-foreground">
                Round {e.round} · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ReviewersTab({ doc, online }: { doc: DocDetail; online: Set<string> }) {
  return (
    <div className="flex flex-col gap-4 p-3">
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-ins this round</h4>
        {doc.reviewers.length ? <CheckInList reviewers={doc.reviewers} /> : <p className="text-sm text-muted-foreground">Not sent for review yet.</p>}
      </section>
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People on this script</h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Dot color={doc.creator_color} />
            {doc.creator_name} <span className="text-xs text-muted-foreground">creator{online.has(doc.creator_id) ? " · here now" : ""}</span>
          </li>
          {doc.reviewers.map((r) => (
            <li key={r.user_id} className="flex items-center gap-2">
              <Dot color={r.color} />
              {r.name}
              <span className="text-xs text-muted-foreground">
                {r.capacity === "VIEW" ? "view and notes only" : r.can_approve ? "content reviewer" : "suggesting reviewer"}
                {online.has(r.user_id) ? " · here now" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {doc.decision_note && (
        <section>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last decision</h4>
          <p className="text-sm">
            {doc.decided_by_name}: {doc.decision_note}
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Everything beside the script, in four tabs with counts so nothing is hidden: the notes people left, the rulebook flags,
 * who has checked in, and the history of changes and versions.
 */
export default function DocSidePanel(props: {
  doc: DocDetail;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  notes: DocNote[];
  online: Set<string>;
  editor: React.RefObject<CollabEditorHandle | null>;
  me: string;
  activeId: string | null;
  composer: { quote: string } | null;
  onPick: (n: DocNote) => void;
  onReply: (id: string, text: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onCompose: (text: string) => void;
  onCancelCompose: () => void;
}) {
  const { doc, tab, onTab } = props;
  const openNotes = useMemo(() => props.notes.filter((n) => !n.resolved).length, [props.notes]);
  const waiting = doc.reviewers.filter((r) => r.capacity === "EDIT" && !r.checked_in).length;
  const tabs: { key: PanelTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "notes", label: "Notes", icon: <MessageSquare className="h-4 w-4" />, badge: openNotes },
    { key: "checks", label: "Flags", icon: <Flag className="h-4 w-4" /> },
    { key: "reviewers", label: "Review", icon: <Users className="h-4 w-4" />, badge: doc.status === "IN_REVIEW" ? waiting : undefined },
    { key: "history", label: "History", icon: <HistoryIcon className="h-4 w-4" /> },
  ];
  return (
    <aside className="flex min-h-0 w-full flex-col border-t bg-background lg:w-[22rem] lg:shrink-0 lg:border-l lg:border-t-0">
      <div role="tablist" className="grid grid-cols-4 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 px-1 py-2 text-xs font-medium",
              tab === t.key ? "border-b-2 border-blue-600 text-blue-700 dark:text-blue-300" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {t.icon}
            {t.label}
            {!!t.badge && <span className="absolute right-2 top-1 rounded-full bg-blue-600 px-1.5 text-[10px] leading-4 text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "notes" && (
          <NotesTab
            notes={props.notes}
            activeId={props.activeId}
            canNote={doc.access.can_note}
            me={props.me}
            onPick={props.onPick}
            onReply={props.onReply}
            onResolve={props.onResolve}
            onDelete={props.onDelete}
            composer={props.composer}
            onCompose={props.onCompose}
            onCancelCompose={props.onCancelCompose}
          />
        )}
        {tab === "checks" && <ChecksTab doc={doc} editor={props.editor} />}
        {tab === "reviewers" && <ReviewersTab doc={doc} online={props.online} />}
        {tab === "history" && <HistoryTab doc={doc} />}
      </div>
    </aside>
  );
}
