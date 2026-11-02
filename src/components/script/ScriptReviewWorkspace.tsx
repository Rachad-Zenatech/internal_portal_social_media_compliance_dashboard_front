import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Eye, FileText, Globe2, Loader2, PencilLine, RotateCcw, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ScriptEditor, { type ScriptEditorHandle } from "@/components/script/ScriptEditor";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import { REC_BADGE, overallPostDecision } from "@/components/submissions/TopicTrend";
import { DiffLegend, InlineDiff, StageSteps, isStructured } from "@/components/script/ScriptDiff";
import { usePublicMood } from "@/hooks/usePublicMood";
import { ContextNote, FINDING_ORDER, FindingGroup, StatusPill, groupFindings, isWarning, statusOf } from "@/components/submissions/FindingStatus";
import { useLiveScriptCheck, useScriptActions, useScriptStage } from "@/hooks/useScript";
import { replaceInText } from "@/lib/replaceQuote";
import { SOURCE_LABELS, scriptVerdict } from "@/lib/scriptStage";
import { changesOf, diffWords } from "@/lib/wordDiff";
import type { ComplianceViolation } from "@/services/complianceService";
import type { ScriptVersion } from "@/types/script";
import type { StoredCheck } from "@/types/submission";

type PanelTab = "flags" | "sentiment" | "history";
type Compare = "mine" | "previous";

const sameText = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

const draftKey = (id: string, version: number) => `scriptReview.draft.${id}.${version}`;
function readDraft(id: string, version: number): string | null {
  try {
    return localStorage.getItem(draftKey(id, version));
  } catch {
    return null;
  }
}
function writeDraft(id: string, version: number, text: string | null) {
  try {
    if (text == null) localStorage.removeItem(draftKey(id, version));
    else localStorage.setItem(draftKey(id, version), text);
  } catch {
    // Not remembered on this browser; nothing else depends on it.
  }
}

/**
 * The reviewer's script workspace in the Content screener: the script in the middle (read with flagged wording
 * marked, or edited directly with every change tracked), and the check, sentiment and decision on the right.
 */
export default function ScriptReviewWorkspace({
  submissionId,
  isReviewer,
}: {
  submissionId: string;
  isReviewer: boolean;
}) {
  const stage = useScriptStage(submissionId);
  const data = stage.data;
  const sent = data?.versions.at(-1);
  if (stage.isLoading || !data) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground">
        {stage.isError ? `Couldn't load the script: ${(stage.error as Error).message}` : <Loader2 className="w-5 h-5 animate-spin" />}
      </div>
    );
  }
  if (!sent) {
    return <div className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground">This post has no script yet.</div>;
  }
  return (
    <Editor
      key={`${submissionId}-${sent.version_number}`}
      submissionId={submissionId}
      versions={data.versions}
      title={data.title}
      reference={data.reference_code}
      status={data.status}
      canReview={isReviewer && data.can_review}
    />
  );
}

function Editor({
  submissionId,
  versions,
  title,
  reference,
  status,
  canReview,
}: {
  submissionId: string;
  versions: ScriptVersion[];
  title: string;
  reference: string;
  status?: string | null;
  canReview: boolean;
}) {
  const sent = versions[versions.length - 1];
  const previous = versions.length > 1 ? versions[versions.length - 2] : null;
  const [draft, setDraft] = useState(() => (canReview ? readDraft(submissionId, sent.version_number) : null) ?? sent.body);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [showChanges, setShowChanges] = useState(true);
  const [compare, setCompare] = useState<Compare>("mine");
  const [tab, setTab] = useState<PanelTab>("flags");
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const editorRef = useRef<ScriptEditorHandle | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const { decide } = useScriptActions(submissionId);
  const { mood } = usePublicMood(submissionId, true);
  const moodDecision = overallPostDecision(mood);

  const hasEdits = !sameText(draft, sent.body);
  useEffect(() => {
    if (canReview) writeDraft(submissionId, sent.version_number, hasEdits ? draft : null);
  }, [canReview, draft, hasEdits, sent.version_number, submissionId]);

  const live = useLiveScriptCheck(submissionId, draft, sent.body);
  const check: StoredCheck | null | undefined = hasEdits ? live.data ?? sent.check : sent.check;
  const checking = hasEdits && (live.isFetching || !live.data);
  const verdict = scriptVerdict(check);
  const violations = check?.violations ?? [];
  // What still needs attention: cleared triggers aren't marked in the script or counted.
  const active = violations.filter((v) => statusOf(v) !== "CLEARED");
  const grouped = groupFindings(violations, statusOf);
  const terms = active.flatMap((v) => (v.kind === "MISSING_DISCLAIMER" ? [] : v.flagged_terms));

  const parts = useMemo(
    () => (compare === "previous" && previous ? diffWords(previous.body, sent.body) : diffWords(sent.body, draft)),
    [compare, previous, sent.body, draft]
  );
  const changes = useMemo(() => changesOf(parts), [parts]);
  const myChangeCount = useMemo(() => (hasEdits ? changesOf(diffWords(sent.body, draft)).length : 0), [hasEdits, sent.body, draft]);

  /** Open the editor with the flagged wording selected, so the reviewer can type over it. */
  const findInScript = (term: string) => {
    setMode("edit");
    setCompare("mine");
    // The editor is shown on the next render.
    window.setTimeout(() => editorRef.current?.find(term), 60);
  };
  const addDisclaimer = (text: string) => {
    setDraft((d) => `${d.replace(/\s+$/, "")}\n\n${text}\n`);
    setCompare("mine");
  };

  const criticalNeedsNote = !hasEdits && verdict.critical > 0 && !note.trim();
  const sendBack = () => {
    if (!hasEdits && !note.trim()) {
      setNeedNote(true);
      noteRef.current?.focus();
      return;
    }
    decide.mutate({ decision: "SEND_BACK", text: hasEdits ? draft : undefined, note: note.trim() || undefined });
  };
  const approve = () => decide.mutate({ decision: "APPROVE", note: note.trim() || undefined });

  const tabs: { value: PanelTab; label: string; count?: number; alert?: boolean; badge?: { label: string; cls: string } }[] = [
    { value: "flags", label: "Flags", count: active.length, alert: verdict.critical > 0 },
    {
      value: "sentiment",
      label: "Sentiment",
      count: moodDecision ? undefined : mood?.topics.length || undefined,
      badge: moodDecision ? REC_BADGE[moodDecision.recommendation] : undefined,
    },
    { value: "history", label: "History", count: versions.length },
  ];

  return (
    <>
      {/* ===== The script ===== */}
      <section ref={scrollRef} aria-label="Script" className="min-w-0 flex-1 overflow-y-auto bg-muted/30">
        <header className="flex flex-col gap-2.5 border-b border-border/70 bg-card px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <span className="text-xs text-muted-foreground">
              {reference} · version {sent.version_number} · {SOURCE_LABELS[sent.source].toLowerCase()}
              {sent.created_by_name ? ` by ${sent.created_by_name}` : ""} · sent {formatDistanceToNow(new Date(sent.created_at), { addSuffix: true })}
            </span>
          </div>
          <StageSteps status={(status as never) ?? "IN_REVIEW"} />
        </header>

        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card/95 px-5 py-2 backdrop-blur">
          {canReview && (
            <div role="tablist" aria-label="Mode" className="flex rounded-lg bg-muted p-0.5">
              {(
                [
                  ["read", "Read", Eye],
                  ["edit", "Edit", PencilLine],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value);
                    if (value === "edit") setCompare("mine");
                  }}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium ${
                    mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
          {previous && mode === "read" && (
            <div role="tablist" aria-label="Compare" className="flex rounded-lg bg-muted p-0.5">
              {(
                [
                  ["mine", canReview ? "Your changes" : "This version"],
                  ["previous", `Changes since version ${previous.version_number}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={compare === value}
                  onClick={() => setCompare(value)}
                  className={`h-7 rounded-md px-3 text-xs font-medium ${
                    compare === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {mode === "edit" ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <PencilLine className="w-3.5 h-3.5" /> Editing · your changes are tracked
            </span>
          ) : (
            changes.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground/80">
                <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} />
                Show changes
              </label>
            )
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {sent.file_name && (
              <span className="inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> {sent.file_name}
              </span>
            )}
            {canReview && hasEdits && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setDraft(sent.body)}>
                <RotateCcw className="w-3.5 h-3.5" /> Undo my changes
              </Button>
            )}
          </span>
        </div>

        <div className="px-4 py-5 sm:px-6">
          {mode === "edit" ? (
            <div className="mx-auto max-w-[1000px]">
              <ScriptEditor ref={editorRef} value={draft} onChange={setDraft} />
              <p className="mt-2 text-xs text-muted-foreground">
                Edit it like a document. Switch to Read to see your changes marked against the creator's version.
              </p>
            </div>
          ) : (
            <article
              className={
                isStructured(parts)
                  ? "mx-auto max-w-[1000px]"
                  : "mx-auto max-w-[760px] rounded-xl border border-border bg-card px-6 py-7 shadow-xs sm:px-10"
              }
            >
              {changes.length > 0 && showChanges && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <span className="text-xs font-medium text-foreground">
                    {changes.length} change{changes.length === 1 ? "" : "s"}{" "}
                    {compare === "previous" ? `from version ${previous?.version_number}` : canReview ? "by you" : ""}
                  </span>
                  <DiffLegend />
                </div>
              )}
              <InlineDiff parts={parts} terms={compare === "mine" ? terms : []} showChanges={showChanges} focusId={focusId} onPick={setFocusId} />
            </article>
          )}
        </div>
      </section>

      {/* ===== Check, sentiment, history and the decision ===== */}
      <aside
        aria-label="Your review"
        className="flex min-h-[480px] shrink-0 flex-col border-t border-border/70 lg:min-h-0 lg:w-[400px] lg:border-l lg:border-t-0 2xl:w-[440px] min-[112.5rem]:w-[500px]"
      >
        <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] ${verdict.ring}`}>
            {checking ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-center leading-none">
                <span className="block text-xl font-bold tabular-nums text-foreground">{check?.score ?? "–"}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Script check · {hasEdits ? "with your changes" : "as sent"}</p>
            <p className={`text-[15px] font-semibold ${verdict.tone}`}>{verdict.text}</p>
            <p className="text-sm text-muted-foreground">
              {grouped.VIOLATION.length} flag{grouped.VIOLATION.length === 1 ? "" : "s"}
              {verdict.critical > 0 && ` · ${verdict.critical} critical`}
              {grouped.NEEDS_REVIEW.length > 0 && ` · ${grouped.NEEDS_REVIEW.length} to check`}
              {grouped.EVIDENCE_REQUIRED.length > 0 && ` · ${grouped.EVIDENCE_REQUIRED.length} need${grouped.EVIDENCE_REQUIRED.length === 1 ? "s" : ""} a source`}
              {grouped.CLEARED.length > 0 && ` · ${grouped.CLEARED.length} cleared`}
              {hasEdits && sent.check?.score != null && check?.score != null && !checking && ` · was ${sent.check.score}`}
            </p>
          </div>
        </div>

        {/* Live Market & News Sentiment Banner */}
        <button
          type="button"
          onClick={() => setTab("sentiment")}
          className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/50"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span className="font-semibold text-foreground">Market & news sentiment:</span>
            <span className="truncate text-muted-foreground">
              {moodDecision
                ? moodDecision.reason
                : mood?.topics.length
                ? `${mood.topics.length} matched topic${mood.topics.length === 1 ? "" : "s"}`
                : "View live trends & VADER sentiment"}
            </span>
          </span>
          {moodDecision ? (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${REC_BADGE[moodDecision.recommendation].cls}`}>
              {moodDecision.recommendation}
            </span>
          ) : (
            <span className="shrink-0 text-[11px] font-medium text-sky-700 dark:text-sky-300">Open →</span>
          )}
        </button>

        <div role="tablist" aria-label="Review sections" className="flex gap-1 border-b border-border/70 px-3 pt-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors ${
                tab === t.value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${t.badge.cls}`}>
                  {t.badge.label}
                </span>
              )}
              {t.count != null && (
                <span
                  className={`min-w-[18px] rounded-full px-1.5 text-[11px] font-semibold ${
                    t.alert ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-muted text-foreground/70"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
          {tab === "flags" &&
            (violations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-7 h-7 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">No rulebook flags</p>
                <p className="text-xs text-muted-foreground">Nothing in this script broke a rule.</p>
              </div>
            ) : (
              FINDING_ORDER.map((status) => (
                <FindingGroup key={status} status={status} count={grouped[status].length}>
                  {grouped[status].map((v) => (
                    <FlagCard key={v.rule_id} v={v} canEdit={canReview} onFind={findInScript} onAddDisclaimer={addDisclaimer} />
                  ))}
                </FindingGroup>
              ))
            ))}

          {tab === "sentiment" && (
            <>
              <p className="text-xs text-muted-foreground">Reads the script as sent (version {sent.version_number}), with the post's audience and brand.</p>
              <SentimentPanel
                key={`${submissionId}-${sent.version_number}`}
                submissionId={submissionId}
                canRun={canReview}
                onApplyRevision={
                  canReview
                    ? (f) => {
                        const next = f.suggested_revision ? replaceInText(draft, f.quote, f.suggested_revision) : null;
                        if (next == null) return false;
                        setDraft(next);
                        setCompare("mine");
                        return true;
                      }
                    : undefined
                }
              />
            </>
          )}

          {tab === "history" && <VersionHistory versions={versions} />}
        </div>

        {canReview ? (
          <div className="flex flex-col gap-2.5 border-t border-border/70 bg-muted/40 px-4 py-3.5">
            <label htmlFor="script-note" className="flex items-baseline justify-between gap-2 text-xs font-medium text-foreground">
              <span>Comments for the creator</span>
              <span className={needNote ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                {hasEdits ? "Optional with your edits" : "Required to request changes"}
              </span>
            </label>
            <Textarea
              id="script-note"
              ref={noteRef}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (e.target.value.trim()) setNeedNote(false);
              }}
              rows={2}
              placeholder={hasEdits ? "Why you changed it (optional)" : "What needs to change? Required if you request changes"}
              aria-invalid={needNote}
              aria-required={!hasEdits}
              className={`min-h-0 resize-none bg-card text-[13px] ${needNote ? "border-red-500 ring-2 ring-red-500/20 focus-visible:ring-red-500/30" : ""}`}
            />
            {needNote && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                Add a comment saying what needs to change before you request changes.
              </p>
            )}
            <p
              className={`text-xs font-medium ${
                hasEdits ? "text-blue-700 dark:text-blue-300" : verdict.critical ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {hasEdits
                ? `You changed ${myChangeCount} part${myChangeCount === 1 ? "" : "s"}. The creator sees both versions and accepts them before filming.`
                : verdict.critical
                ? "There's a critical flag. Edit the script, send it back, or say in the note why it's fine."
                : "You can approve the script as written."}
            </p>
            {grouped.NEEDS_REVIEW.length + grouped.EVIDENCE_REQUIRED.length > 0 && (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {grouped.NEEDS_REVIEW.length > 0 && `${grouped.NEEDS_REVIEW.length} to check (see Flags)`}
                {grouped.NEEDS_REVIEW.length > 0 && grouped.EVIDENCE_REQUIRED.length > 0 && " · "}
                {grouped.EVIDENCE_REQUIRED.length > 0 && `${grouped.EVIDENCE_REQUIRED.length} claim${grouped.EVIDENCE_REQUIRED.length === 1 ? "" : "s"} need a source`}
                . They don't stop you approving.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant={hasEdits ? "default" : "outline"}
                className="h-10 flex-1"
                disabled={decide.isPending}
                title={!hasEdits && !note.trim() ? "A comment is required to request changes" : undefined}
                onClick={sendBack}
              >
                {decide.isPending && decide.variables?.decision === "SEND_BACK" && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasEdits ? "Send back with edits" : "Request changes"}
              </Button>
              <Button
                variant={hasEdits ? "outline" : "default"}
                className="h-10 flex-1"
                disabled={decide.isPending || hasEdits || criticalNeedsNote}
                title={hasEdits ? "You changed the script, so the creator accepts it first" : criticalNeedsNote ? "Say in the note why the critical flag is fine" : undefined}
                onClick={approve}
              >
                {decide.isPending && decide.variables?.decision === "APPROVE" && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve script
              </Button>
            </div>
          </div>
        ) : status === "APPROVED" ? (
          <div className="flex flex-col gap-2.5 border-t border-border/70 bg-emerald-50/50 p-4 dark:bg-emerald-500/10">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Script approved
            </div>
            <p className="text-xs text-muted-foreground">
              The script is approved and ready. You or the creator can now attach the final video to this submission.
            </p>
            <Button asChild className="h-9 gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white">
              <Link to={`/submissions/new?id=${submissionId}`}>
                <Upload className="w-3.5 h-3.5" /> Attach Video to Post
              </Link>
            </Button>
          </div>
        ) : (
          <p className="border-t border-border/70 bg-muted/40 px-4 py-3.5 text-xs text-muted-foreground">
            {status === "IN_REVIEW" ? "You can't review your own script." : "This script isn't waiting for a review."}
          </p>
        )}
      </aside>
    </>
  );
}

function FlagCard({
  v,
  canEdit,
  onFind,
  onAddDisclaimer,
}: {
  v: ComplianceViolation;
  canEdit: boolean;
  onFind: (term: string) => void;
  onAddDisclaimer: (text: string) => void;
}) {
  const critical = v.traffic_light === "RED";
  const missing = v.kind === "MISSING_DISCLAIMER";
  const cleared = statusOf(v) === "CLEARED";
  return (
    <article className={`flex flex-col gap-2 rounded-xl border border-border bg-card px-3.5 py-3 ${cleared ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-2">
        <StatusPill status={statusOf(v)} critical={critical} />
        <span className="text-xs text-muted-foreground">{missing ? "Missing disclaimer" : "In the script"}</span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{v.rule_number}</p>
        <p className="text-sm font-semibold text-foreground">{v.title}</p>
      </div>
      {v.evaluation ? <ContextNote v={v} /> : <p className="text-[13px] text-foreground/80">{v.explanation}</p>}
      {!missing && !cleared && v.flagged_terms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {v.flagged_terms.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onFind(t)}
              disabled={!canEdit}
              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:cursor-default disabled:hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200"
              title={canEdit ? "Find it in the script and edit it" : undefined}
            >
              {canEdit && <Search className="w-3 h-3" />}“{t}”
            </button>
          ))}
        </div>
      )}
      {v.remediation_guidance && !cleared && (
        <p className="text-[13px] text-foreground/80">
          <span className="font-semibold">{isWarning(v) ? "What to check:" : "How to fix:"}</span> {v.remediation_guidance}
        </p>
      )}
      {missing && !cleared && canEdit && (v.missing_disclaimers?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-foreground/80">“{v.missing_disclaimers![0]}”</p>
          <Button size="sm" variant="outline" className="h-7 self-start text-xs" onClick={() => onAddDisclaimer(v.missing_disclaimers![0])}>
            Add it to the end of the script
          </Button>
        </div>
      )}
    </article>
  );
}

const DECISION_TEXT: Record<string, string> = {
  APPROVED: "Approved",
  EDITED: "Reviewer edited it",
  CHANGES_REQUESTED: "Changes requested",
};

/** Every version of the script, newest first, with the reviewer's call and note on each. */
export function VersionHistory({ versions }: { versions: ScriptVersion[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {[...versions].reverse().map((v) => (
        <li key={v.version_number} className="rounded-xl border border-border bg-card px-3.5 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              Version {v.version_number} · {SOURCE_LABELS[v.source]}
            </span>
            {v.check?.score != null && <span className="text-xs tabular-nums text-muted-foreground">Score {v.check.score}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {v.created_by_name ?? "Someone"} · {format(new Date(v.created_at), "MMM d, h:mm a")}
            {v.file_name ? ` · ${v.file_name}` : ""}
          </p>
          {v.review_decision && (
            <p className="mt-1.5 text-xs">
              <span className="font-semibold text-foreground">{DECISION_TEXT[v.review_decision] ?? v.review_decision}</span>
              <span className="text-muted-foreground">
                {v.reviewed_by_name ? ` by ${v.reviewed_by_name}` : ""}
                {v.reviewed_at ? `, ${format(new Date(v.reviewed_at), "MMM d")}` : ""}
              </span>
              {v.review_note && <span className="mt-1 block rounded-lg bg-muted px-2.5 py-1.5 text-foreground/80">“{v.review_note}”</span>}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
