import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import { HIGHLIGHT_COLORS } from "@/components/scriptdoc/DocEditorColumn";
import { CheckInList, Dot } from "@/components/scriptdoc/ReviewDialogs";
import ScriptCompliance, { activeFlagCount } from "@/components/script/ScriptCompliance";
import ScriptFindings from "@/components/script/ScriptFindings";
import ReviewGlance, { type GlanceTile } from "@/components/submissions/ReviewGlance";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSentiment } from "@/hooks/useSentiment";
import { cn } from "@/lib/utils";
import { scriptDocService } from "@/services/scriptDocService";
import type { DocDetail, DocHistory, DocNote } from "@/types/scriptDoc";
import type { StoredCheck } from "@/types/submission";
import ScriptSourcesPanel from "@/components/scriptdoc/ScriptSourcesPanel";
import { useScriptDocSources } from "@/hooks/useScriptDocSources";
import { scriptSourceEntries, scriptSourcesMatch } from "@/lib/scriptSources";

export type PanelTab = "notes" | "checks" | "sentiment" | "history" | "reviewers" | "sources";

/** Unified Highlight & Comment composer on the selected wording (comment text is optional). */
function NoteComposer({
  quote,
  initialColor = "#eab308",
  onCompose,
  onCancel,
}: {
  quote: string;
  initialColor?: string;
  onCompose: (text: string, color: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(initialColor);
  useEffect(() => {
    setColor(initialColor);
  }, [initialColor, quote]);

  return (
    <div className="rounded-md border bg-card p-2.5 shadow-xs" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <p className="mb-2 line-clamp-2 text-xs italic text-muted-foreground">“{quote}”</p>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            onClick={() => setColor(c.hex)}
            className={cn(
              "h-4 w-4 rounded-full border transition-transform hover:scale-110",
              color.toLowerCase() === c.hex ? "ring-2 ring-foreground ring-offset-1" : "border-border",
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Custom colour"
          className="ml-auto h-5 w-5 cursor-pointer rounded border border-border bg-transparent p-0"
        />
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Add a comment (optional) — or save just the highlight"
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onCompose(text.trim(), color)}>
          {text.trim() ? "Save Highlight & Comment" : "Save Highlight"}
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
  composer: { quote: string; color?: string } | null;
  onCompose: (text: string, color: string) => void;
  onCancelCompose: () => void;
}) {
  const [reply, setReply] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const open = notes.filter((n) => !n.resolved);
  const resolved = notes.filter((n) => n.resolved);
  const shown = showResolved ? notes : open;

  return (
    <div className="flex flex-col gap-3 p-3">
      {composer && <NoteComposer quote={composer.quote} initialColor={composer.color} onCompose={onCompose} onCancel={onCancelCompose} />}
      {shown.length === 0 && !composer && (
        <p className="text-sm text-muted-foreground">
          {canNote ? "Select wording in the script, then click Highlight & Comment above it." : "No notes yet."}
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
              <span>· {n.text ? "highlight & comment" : "highlight"}</span>
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
function ChecksTab({
  doc,
  editor,
  check,
  running,
  onRun,
}: {
  doc: DocDetail;
  editor: React.RefObject<CollabEditorHandle | null>;
  check: StoredCheck | null;
  running: boolean;
  onRun: () => void;
}) {
  const flags = activeFlagCount(check);
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onRun} disabled={running}>
          {running && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
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
  SOURCES: "updated the script sources",
};

function HistoryTab({ data, isLoading }: { data?: DocHistory; isLoading: boolean }) {
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
  composer: { quote: string; color?: string } | null;
  onPick: (n: DocNote) => void;
  onReply: (id: string, text: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onCompose: (text: string, color: string) => void;
  onCancelCompose: () => void;
}) {
  const { doc, tab, onTab } = props;
  const [seen, setSeen] = useState<Set<PanelTab>>(() => new Set([tab]));
  const pickTab = (t: PanelTab) => {
    setSeen((prev) => (prev.has(t) ? prev : new Set(prev).add(t)));
    onTab(t);
  };

  const queryClient = useQueryClient();
  const sources = useScriptDocSources(doc);
  const { data: savedCheck = null } = useQuery<StoredCheck | null>({ queryKey: ["script-doc-check", doc.id], queryFn: async () => null, enabled: false });
  const check = savedCheck && scriptSourcesMatch(savedCheck.checked_script_sources, doc.sources_text ?? "") ? savedCheck : null;
  const runCheck = useMutation({
    mutationFn: () => {
      if (sources.dirty) throw new Error("Save sources before running compliance.");
      return scriptDocService.check(doc.id, props.editor.current?.getText());
    },
    onSuccess: (result) => queryClient.setQueryData(["script-doc-check", doc.id], result),
    onError: (e: any) => toast.error(e?.message ?? "The check couldn't run"),
  });
  const historyQuery = useQuery({
    queryKey: ["script-doc-history", doc.id, doc.status, doc.round],
    queryFn: () => scriptDocService.history(doc.id),
  });
  const submissionId = doc.posts[0]?.submission_id ?? "";
  const { analysis: sentiment } = useSentiment(submissionId);

  const openNotes = useMemo(() => props.notes.filter((n) => !n.resolved).length, [props.notes]);
  const waiting = doc.reviewers.filter((r) => r.capacity === "EDIT" && !r.checked_in).length;
  const flags = activeFlagCount(check);
  const violations = check?.violations ?? [];
  const criticalCount = violations.filter((v) => v.traffic_light === "RED").length;
  const needsReviewCount = violations.filter((v) => v.status === "NEEDS_REVIEW").length;
  const evidenceCount = violations.filter((v) => v.status === "EVIDENCE_REQUIRED").length;
  const flagWords = [
    criticalCount > 0 ? `${criticalCount} critical` : "",
    needsReviewCount > 0 ? `${needsReviewCount} to check` : "",
    evidenceCount > 0 ? `${evidenceCount} need${evidenceCount === 1 ? "s" : ""} a source` : "",
  ].filter(Boolean);

  const sentimentBusy = sentiment ? ["PENDING", "PROCESSING", "WAITING_TRANSCRIPT", "SCHEDULED"].includes(sentiment.status) : false;
  const sentimentDone = sentiment?.status === "COMPLETED" && sentiment.result;
  const versionCount = historyQuery.data?.versions.length ?? 0;

  const tiles: GlanceTile[] = [
    {
      key: "sources", label: "Sources",
      value: `${scriptSourceEntries(doc.sources_text ?? "").length} attached`,
      sub: sources.dirty ? "Unsaved changes" : "Evidence for this script",
      tone: sources.dirty ? "warn" : "muted", seen: seen.has("sources"),
    },
    {
      key: "checks",
      label: "Flags",
      value: check?.ai_unavailable ? "No check" : check ? (flags > 0 ? `${flags} open` : "Nothing open") : "Not run",
      sub: check?.ai_unavailable ? "The check couldn't run" : check ? flagWords.join(" · ") || "No flags on the script" : "Run rulebook check",
      tone: check?.ai_unavailable ? "muted" : criticalCount > 0 ? "bad" : flags > 0 ? "warn" : check ? "ok" : "muted",
      seen: seen.has("checks"),
    },
    {
      key: "notes",
      label: "Highlighted",
      value: openNotes > 0 ? `${openNotes} marked` : "None",
      sub: openNotes > 0 ? "Places marked for changes" : "Select text in the script to mark it",
      tone: openNotes > 0 ? "warn" : "muted",
      seen: seen.has("notes"),
    },
    {
      key: "sentiment",
      label: "Sentiment",
      value: sentimentDone ? sentiment.result!.overall_assessment.replace(/_/g, " ") : sentimentBusy ? "Running" : "Not run",
      sub: sentimentDone ? "Read on the script" : sentimentBusy ? "Will appear here" : submissionId ? "Run it from here" : "Available on post",
      tone: "muted",
      seen: seen.has("sentiment"),
    },
    {
      key: "history",
      label: "History",
      value: versionCount ? `${versionCount} version${versionCount === 1 ? "" : "s"}` : "0 versions",
      sub: versionCount <= 1 ? "First version" : `Previous: version ${versionCount - 1}`,
      tone: "muted",
      seen: seen.has("history"),
    },
  ];

  return (
    <aside className="flex min-h-0 w-full flex-col border-t bg-background lg:w-[22rem] lg:shrink-0 lg:border-l lg:border-t-0">
      <ReviewGlance
        tiles={tiles}
        active={tab}
        onPick={(key) => pickTab(key as PanelTab)}
        extra={[{ key: "reviewers", label: doc.status === "IN_REVIEW" && waiting > 0 ? `Review (${waiting} waiting)` : "Review & people" }]}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "sources" && <ScriptSourcesPanel doc={doc} {...sources} onChange={sources.setDraft} onSave={sources.save} onReset={sources.reset} check={check} running={runCheck.isPending} onRun={() => runCheck.mutate()} />}
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
        {tab === "checks" && (
          <ChecksTab doc={doc} editor={props.editor} check={check} running={runCheck.isPending} onRun={() => runCheck.mutate()} />
        )}
        {tab === "sentiment" && (
          <div className="p-3">
            {submissionId ? (
              <SentimentPanel
                key={submissionId}
                submissionId={submissionId}
                canRun={doc.access.role !== "VIEWER"}
              />
            ) : (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Sentiment and public mood read a post, so they become available when this script is attached to a post.
              </p>
            )}
          </div>
        )}
        {tab === "reviewers" && <ReviewersTab doc={doc} online={props.online} />}
        {tab === "history" && <HistoryTab data={historyQuery.data} isLoading={historyQuery.isLoading} />}
      </div>
    </aside>
  );
}
