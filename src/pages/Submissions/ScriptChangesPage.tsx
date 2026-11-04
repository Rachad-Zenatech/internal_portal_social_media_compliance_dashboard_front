import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, Download, Loader2, PencilLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import NoteField from "@/components/script/NoteField";
import ScriptEditor from "@/components/script/ScriptEditor";
import { displayText } from "@/lib/scriptDoc";
import { updatedWording } from "@/lib/highlightChange";
import HighlightCards from "@/components/script/HighlightCards";
import HighlightableText, { type HighlightableHandle } from "@/components/script/HighlightableText";
import { DiffLegend, InlineDiff, SideBySide, StageSteps, isStructured } from "@/components/script/ScriptDiff";
import { VersionHistory } from "@/components/script/ScriptReviewWorkspace";
import { SOURCE_LABELS, scriptVerdict } from "@/lib/scriptStage";
import { useScriptActions, useScriptHighlights, useScriptStage } from "@/hooks/useScript";
import { changesOf, diffWords } from "@/lib/wordDiff";
import type { ScriptStage, ScriptVersion } from "@/types/script";

type View = "inline" | "side";

const initials = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Which two versions to compare: what the creator sent and what came back (or the last round's change). */
function comparison(stage: ScriptStage): { base: ScriptVersion | null; shown: ScriptVersion } | null {
  const v = stage.versions;
  const latest = v[v.length - 1];
  if (!latest) return null;
  if (latest.source === "REVIEWER_EDIT") {
    // The version the reviewer edited: the newest one before it that isn't another reviewer edit.
    const base = [...v.slice(0, -1)].reverse().find((x) => x.source !== "REVIEWER_EDIT") ?? null;
    return { base, shown: latest };
  }
  return { base: v.length > 1 ? v[v.length - 2] : null, shown: latest };
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The creator's view of their script after review: both versions (marked in place or side by side), the list of
 * changes, and accept or edit. Also where they read an approved script before filming.
 */
export default function ScriptChangesPage() {
  const { id = "" } = useParams();
  const stage = useScriptStage(id);
  if (stage.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (stage.isError || !stage.data) {
    return <p className="p-8 text-sm text-red-600">Couldn't load the script: {(stage.error as Error | null)?.message ?? "not found"}</p>;
  }
  return <Changes key={stage.data.versions.length} stage={stage.data} />;
}

const noop = () => undefined;

function Changes({ stage }: { stage: ScriptStage }) {
  const navigate = useNavigate();
  const pair = comparison(stage);
  const status = stage.status ?? "DRAFT";
  const [view, setView] = useState<View>("inline");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(pair?.shown.body ?? "");
  // The note for the reviewer lives in its own box (see NoteField), so typing does not redraw the script.
  const noteValue = useRef("");
  const [focusId, setFocusId] = useState<number | null>(null);
  const { accept, revise } = useScriptActions(stage.submission_id);

  const base = pair?.base ?? null;
  const shown = pair?.shown;
  const parts = useMemo(() => (shown ? diffWords(base?.body ?? shown.body, shown.body) : []), [base, shown]);
  const changes = useMemo(() => changesOf(parts), [parts]);
  const fromReviewer = shown?.source === "REVIEWER_EDIT";
  // The reviewer marked up the version they were reading: the one before their own edit, else the one shown.
  const textRef = useRef<HighlightableHandle | null>(null);
  // The reviewer's highlights the creator has checked off while editing.
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const toggleDone = (id: string) =>
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [tab, setTab] = useState<"request" | "history">("request");
  const { highlights, resolve } = useScriptHighlights(stage.submission_id, fromReviewer ? base?.version_number : shown?.version_number, false);
  // Every request from the reviewer must be checked off before the script can go back.
  const unchecked = highlights.filter((h) => !doneIds.has(h.id)).length;
  const allChecked = unchecked === 0;
  // The note the reviewer left on the version they decided on.
  const decided = [...stage.versions].reverse().find((v) => v.review_decision);
  const reviewer = fromReviewer ? shown?.created_by_name : decided?.reviewed_by_name;
  const postLink = `/submissions/new?id=${stage.submission_id}`;

  // The breadcrumb shows the post's reference rather than its id.
  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent("set-breadcrumb-title", { detail: { path: `/submissions/${stage.submission_id}`, title: stage.reference_code } })
    );
  }, [stage.submission_id, stage.reference_code]);

  /** A highlight card was clicked: find that wording in the script and flash it. */
  const goToHighlight = (id: string) => {
    const switching = view === "side" && !editing;
    if (switching) setView("inline");
    window.setTimeout(() => textRef.current?.goTo(id), switching ? 80 : 0);
  };

  const pick = (changeId: number) => {
    setFocusId(changeId);
    document.getElementById(`change-${changeId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!shown) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">No script has been sent for review yet.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={postLink}>Back to the post</Link>
        </Button>
      </div>
    );
  }

  const verdict = scriptVerdict(editing ? null : shown.check);
  const canEdit = stage.can_respond;

  return (
    <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:h-[calc(100dvh-10.5rem)] lg:flex-row">
      {/* ===== The versions ===== */}
      <section aria-label="Script" className="min-w-0 flex-1 overflow-y-auto bg-muted/30">
        <header className="flex flex-col gap-2.5 border-b border-border/70 bg-card px-5 py-4 sm:px-6">
          <Link to={postLink} className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to the post
          </Link>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-lg font-semibold text-foreground">{stage.title}</h1>
            <span className="text-xs text-muted-foreground">{stage.reference_code}</span>
          </div>
          <StageSteps status={status} />
        </header>

        {/* What happened, and who it's waiting on */}
        <div className="px-5 pt-4 sm:px-6">
          {status === "EDITS_PROPOSED" && (
            <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-500/10">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-700 text-xs font-semibold text-white">{initials(reviewer)}</span>
              <div className="min-w-0">
                <p className="text-[13px]">
                  <span className="font-semibold text-foreground">{reviewer ?? "Your reviewer"}</span>{" "}
                  <span className="text-muted-foreground">
                    changed {changes.length} part{changes.length === 1 ? "" : "s"} of your script · {format(new Date(shown.created_at), "MMM d, h:mm a")}
                  </span>
                </p>
                {decided?.review_note && <p className="mt-0.5 text-[13px] text-blue-950 dark:text-blue-100">“{decided.review_note}”</p>}
              </div>
            </div>
          )}
          {status === "CHANGES_REQUESTED" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">{reviewer ?? "Your reviewer"} asked for changes</p>
              {decided?.review_note && <p className="mt-0.5 text-[13px] text-amber-950 dark:text-amber-100">“{decided.review_note}”</p>}
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">Edit the script here, or upload a new file on the post.</p>
            </div>
          )}
          {status === "IN_REVIEW" && (
            <p className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
              Version {shown.version_number} is with a reviewer. You'll get a notification when they reply.
            </p>
          )}
          {status === "APPROVED" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" /> Script approved
                </p>
                <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">Film from this version. The video is checked against it.</p>
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => navigate(postLink)}>
                <Upload className="w-3.5 h-3.5" /> Upload the video
              </Button>
            </div>
          )}
        </div>

        {/* View switch */}
        <div className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-4 sm:px-6">
          {base && !editing && (
            <div role="tablist" aria-label="How to show the changes" className="flex rounded-lg bg-muted p-0.5">
              {(
                [
                  ["inline", "Highlighted changes"],
                  ["side", "Side by side"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  onClick={() => setView(value)}
                  className={`h-8 rounded-md px-3.5 text-[13px] font-medium ${
                    view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {base && !editing && changes.length > 0 && <DiffLegend />}
          <span className="ml-auto text-xs text-muted-foreground">
            {editing
              ? `Editing a new version (${stage.versions.length + 1})`
              : base
              ? `Version ${base.version_number} (${SOURCE_LABELS[base.source].toLowerCase()}) → version ${shown.version_number} (${SOURCE_LABELS[shown.source].toLowerCase()})`
              : `Version ${shown.version_number}`}
          </span>
        </div>

        <div className="px-5 pb-6 sm:px-6">
          {editing ? (
            <div className="mx-auto flex max-w-[1000px] flex-col gap-2">
              <p className="text-[13px] text-muted-foreground">
                {fromReviewer ? `You're editing ${reviewer ?? "the reviewer"}'s version.` : "You're editing your script."} It's checked again and goes back to the
                reviewer, who sees what you changed.
              </p>
              <HighlightableText ref={textRef} value={highlights} layoutKey={text.length}>
                <ScriptEditor value={text} onChange={setText} />
              </HighlightableText>
            </div>
          ) : base && view === "side" ? (
            <SideBySide
              parts={parts}
              left={{ title: base.source === "REVIEWER_EDIT" ? "Reviewer's earlier version" : "Your version", sub: `v${base.version_number} · ${format(new Date(base.created_at), "MMM d")}` }}
              right={{
                title: fromReviewer ? "Reviewer's version" : "Latest version",
                sub: `v${shown.version_number}${shown.created_by_name ? ` · ${shown.created_by_name}` : ""} · ${format(new Date(shown.created_at), "MMM d")}`,
              }}
              focusId={focusId}
              onPick={setFocusId}
            />
          ) : (
            <article
              className={
                isStructured(parts)
                  ? "mx-auto max-w-[1000px]"
                  : "mx-auto max-w-[760px] rounded-xl border border-border bg-card px-6 py-7 shadow-xs sm:px-10"
              }
            >
              <HighlightableText ref={textRef} value={highlights} layoutKey={`${base?.version_number}|${shown.version_number}`}>
                <InlineDiff parts={parts} focusId={focusId} onPick={setFocusId} />
              </HighlightableText>
            </article>
          )}
        </div>
      </section>

      {/* ===== Changes and what to do ===== */}
      <aside aria-label="Changes" className="flex shrink-0 flex-col border-t border-border/70 lg:w-[380px] lg:border-l lg:border-t-0 min-[112.5rem]:w-[440px]">
        <div role="tablist" aria-label="Review sections" className="flex gap-1 border-b border-border/70 px-3 pt-2">
          {(
            [
              ["request", "Request changes", highlights.length + (base ? changes.length : 0)],
              ["history", "Script history", stage.versions.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors ${
                tab === value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="min-w-[18px] rounded-full bg-muted px-1.5 text-[11px] font-semibold text-foreground/70">{count}</span>
            </button>
          ))}
        </div>
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {tab === "history"
              ? "Every version and the reviewer's notes."
              : "What your reviewer marked and changed. Click one to find it in the script."}
            {base?.check?.score != null && shown.check?.score != null && ` Script check: ${base.check.score} → ${shown.check.score}.`}
            {!base && shown.check?.score != null && ` Script check: ${shown.check.score}/100 · ${verdict.text.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {tab === "history" ? (
            <VersionHistory versions={stage.versions} />
          ) : (
            <>
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Highlighted and noted ({highlights.length})
              </p>
              <HighlightCards
                highlights={highlights}
                onPick={goToHighlight}
                empty="Your reviewer hasn't highlighted or commented on this version."
                done={editing ? doneIds : new Set(highlights.filter((h) => h.done).map((h) => h.id))}
                onToggleDone={editing ? toggleDone : undefined}
              />
              {base && (
                <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {changes.length} change{changes.length === 1 ? "" : "s"}
                  {fromReviewer ? " from your reviewer" : ""}
                </p>
              )}
            </>
          )}
          {tab === "request" && base &&
            changes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                  focusId === c.id ? "border-blue-500 bg-blue-50/50 dark:bg-blue-500/5" : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {c.number}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{displayText(c.before) ? `after “…${displayText(c.before)}”` : "at the start of a line"}</span>
                </span>
                {c.removed && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[13px] text-red-800 line-through dark:bg-red-500/20 dark:text-red-300">{displayText(c.removed) || "(formatting)"}</span>}
                {c.added && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[13px] text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">{displayText(c.added) || "(formatting)"}</span>}
              </button>
            ))}
          {tab === "request" && base && changes.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">The wording is the same.</p>}
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border/70 bg-muted/40 px-4 py-3.5">
          {editing ? (
            <>
              <NoteField
                valueRef={noteValue}
                onHasText={noop}
                rows={2}
                placeholder="Note for the reviewer (optional): what you changed and why"
                aria-label="Note for the reviewer"
                className="min-h-0 resize-none bg-card text-[13px]"
              />
              {!allChecked && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Check off {unchecked} more request{unchecked === 1 ? "" : "s"} in Request changes to send this back.
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 flex-1" onClick={() => setEditing(false)} disabled={revise.isPending}>
                  Cancel
                </Button>
                <Button
                  className="h-10 flex-1"
                  disabled={revise.isPending || resolve.isPending || !text.trim() || !allChecked}
                  title={allChecked ? undefined : "Check every request in Request changes first"}
                  onClick={async () => {
                    // Record what the checked highlights read now, so the reviewer sees old wording → new wording.
                    const reviewed = fromReviewer ? base : shown;
                    const checked = highlights.filter((h) => doneIds.has(h.id));
                    if (reviewed && checked.length > 0) {
                      const found = changesOf(diffWords(reviewed.body, text));
                      try {
                        await resolve.mutateAsync(checked.map((h) => ({ id: h.id, done: true, updated: updatedWording(h.text, found) })));
                      } catch (err) {
                        toast.error(`Couldn't save which highlights are done: ${(err as Error).message}`);
                        return;
                      }
                    }
                    revise.mutate(
                      { text, note: noteValue.current.trim() || undefined },
                      {
                        onSuccess: () => {
                          setEditing(false);
                          // Sent back to the reviewer: back to the portal home, where the next steps are listed.
                          navigate("/dashboard");
                        },
                      }
                    );
                  }}
                >
                  {(revise.isPending || resolve.isPending) && <Loader2 className="w-4 h-4 animate-spin" />} Send to reviewer
                </Button>
              </div>
            </>
          ) : status === "EDITS_PROPOSED" && canEdit ? (
            <>
              <p className="text-[13px] text-foreground/80">Accepting approves the script and unlocks the video upload.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 flex-1 gap-1.5" onClick={() => setEditing(true)}>
                  <PencilLine className="w-4 h-4" /> Edit the script
                </Button>
                <Button className="h-10 flex-1" disabled={accept.isPending} onClick={() => accept.mutate()}>
                  {accept.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Accept changes
                </Button>
              </div>
            </>
          ) : status === "CHANGES_REQUESTED" && canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={() => navigate(postLink)}>
                Upload a new file
              </Button>
              <Button className="h-10 flex-1 gap-1.5" onClick={() => setEditing(true)}>
                <PencilLine className="w-4 h-4" /> Edit here
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="h-10 gap-1.5"
              onClick={() => downloadText(`${stage.reference_code}-script-v${shown.version_number}.txt`, shown.body)}
            >
              <Download className="w-4 h-4" /> Download this version
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
