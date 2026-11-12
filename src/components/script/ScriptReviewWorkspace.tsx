import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { locateOnPage } from "@/lib/locateOnPage";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, Eye, FileText, Loader2, PencilLine, RotateCcw, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import NoteField from "@/components/script/NoteField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RevisionTimelinePicker, { DEFAULT_TIMELINE, timelineFields, timelineValid, type Timeline } from "@/components/submissions/RevisionTimelinePicker";
import { ResizablePanel } from "@/components/ui/ResizeHandle";
import HighlightCards, { AddressedCards } from "@/components/script/HighlightCards";
import HighlightableText, { type Highlight, type HighlightableHandle } from "@/components/script/HighlightableText";
import ScriptBatchBar from "@/components/script/ScriptBatchBar";
import ScriptEditor, { type ScriptEditorHandle } from "@/components/script/ScriptEditor";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import { overallPostDecision } from "@/components/submissions/TopicTrend";
import { DiffLegend, InlineDiff, StageSteps, isStructured } from "@/components/script/ScriptDiff";
import { usePublicMood } from "@/hooks/usePublicMood";
import { useSentiment } from "@/hooks/useSentiment";
import ReviewGlance, { type GlanceTile } from "@/components/submissions/ReviewGlance";
import { ContextNote, FINDING_ORDER, FindingGroup, StatusPill, groupFindings, isWarning, statusOf } from "@/components/submissions/FindingStatus";
import { useLiveScriptCheck, useScriptActions, useScriptHighlights, useScriptStage } from "@/hooks/useScript";
import { replaceInText } from "@/lib/replaceQuote";
import { SOURCE_LABELS, scriptVerdict } from "@/lib/scriptStage";
import { AI_UNAVAILABLE_SHORT } from "@/components/submissions/submissionUi";
import { changesOf, diffWords } from "@/lib/wordDiff";
import type { ComplianceViolation } from "@/services/complianceService";
import type { ScriptVersion } from "@/types/script";
import type { StoredCheck } from "@/types/submission";

type PanelTab = "flags" | "highlights" | "sentiment" | "history";

/** How the sentiment analysis read, in a word, for its tile (the same words as a post's review). */
const SENTIMENT_TILE: Record<string, { label: string; tone: GlanceTile["tone"] }> = {
  NO_CONCERNS: { label: "No concerns", tone: "ok" },
  REVIEW_SUGGESTED: { label: "Review suggested", tone: "warn" },
  SIGNIFICANT_CONCERNS: { label: "Concerns", tone: "bad" },
  INSUFFICIENT_INFORMATION: { label: "Not enough to judge", tone: "muted" },
};
type Compare = "mine" | "previous";

/** Prefix of the display-only marks for what the creator fixed. */
const ADDRESSED = "done-";

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
  onUploadScript,
  onOpenScript,
}: {
  submissionId: string;
  isReviewer: boolean;
  onUploadScript?: () => void;
  /** Open another script of the batch this one came in (the screener keeps its list, so it picks the script itself). */
  onOpenScript?: (submissionId: string) => void;
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
    return (
      <div className="grid flex-1 place-items-center p-10 text-center">
        <div className="max-w-md space-y-3">
          <FileText className="mx-auto w-10 h-10 text-blue-600/70" />
          <p className="text-base font-semibold text-foreground">This post has no script yet.</p>
          <p className="text-xs text-muted-foreground">Upload the script to start the compliance check.</p>
          {onUploadScript && (
            <Button
              type="button"
              size="sm"
              className="mt-2 h-8 gap-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white"
              onClick={onUploadScript}
            >
              <FileText className="w-3.5 h-3.5" /> Upload the script
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    // A script from a batch has the batch's strip across the top; the script and its review panel sit side by side below.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {data.batch && <ScriptBatchBar batch={data.batch} reviewer={isReviewer} onOpen={onOpenScript} />}
      <div className="flex min-h-0 min-w-0 flex-1">
        <Editor
          key={`${submissionId}-${sent.version_number}`}
          submissionId={submissionId}
          versions={data.versions}
          title={data.title}
          reference={data.reference_code}
          status={data.status}
          canReview={isReviewer && data.can_review}
          onUploadScript={onUploadScript}
        />
      </div>
    </div>
  );
}

function Editor({
  submissionId,
  versions,
  title,
  reference,
  status,
  canReview,
  onUploadScript,
}: {
  submissionId: string;
  versions: ScriptVersion[];
  title: string;
  reference: string;
  status?: string | null;
  canReview: boolean;
  onUploadScript?: () => void;
}) {
  const sent = versions[versions.length - 1];
  const previous = versions.length > 1 ? versions[versions.length - 2] : null;
  const [draft, setDraft] = useState(() => (canReview ? readDraft(submissionId, sent.version_number) : null) ?? sent.body);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [showChanges, setShowChanges] = useState(true);
  const [compare, setCompare] = useState<Compare>("mine");
  const [tab, setTabState] = useState<PanelTab>("flags");
  // What the reviewer has opened, so the tiles show what is still to look at.
  const [seen, setSeen] = useState<Set<PanelTab>>(() => new Set<PanelTab>(["flags"]));
  const setTab = useCallback((next: PanelTab) => {
    setTabState(next);
    setSeen((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);
  // The comment text lives in the box itself (see NoteField); the page only knows whether there is any.
  const noteValue = useRef("");
  const [needNote, setNeedNote] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const onNoteText = useCallback((has: boolean) => {
    setHasNote(has);
    if (has) setNeedNote(false);
  }, []);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const editorRef = useRef<ScriptEditorHandle | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HighlightableHandle | null>(null);
  const { highlights, onChange: onHighlightsChange } = useScriptHighlights(submissionId, sent.version_number, canReview);
  // What the creator did about the highlights from the review before this version (shown only once they responded).
  const reviewedBefore = [...versions].reverse().find((v) => v.review_decision && v.version_number < sent.version_number);
  const { highlights: earlier } = useScriptHighlights(submissionId, reviewedBefore?.version_number, false);
  const responded = earlier.some((h) => h.done);
  // The creator's fixes, marked in the script at the new wording with a note reading: old wording → new wording.
  const addressedMarks = useMemo<Highlight[]>(
    () =>
      earlier
        .filter((h) => h.done)
        .flatMap((h) => {
          const now = h.updated == null ? h.text : h.updated.trim();
          if (!now) return []; // removed: nothing left to mark (the cards still list it)
          const changed = now !== h.text.trim();
          return [
            {
              id: `${ADDRESSED}${h.id}`,
              start: h.start,
              text: now,
              color: "#34d399",
              note: changed ? `“${h.text}” ➜ “${now}”` : `“${h.text}”: marked done, wording unchanged`,
            },
          ];
        }),
    [earlier]
  );
  const shownHighlights = useMemo(() => [...highlights, ...addressedMarks], [highlights, addressedMarks]);
  // Those marks are display only: they are never saved as this version's highlights.
  const saveHighlights = onHighlightsChange
    ? (next: Highlight[]) => onHighlightsChange(next.filter((h) => !h.id.startsWith(ADDRESSED)))
    : undefined;
  // Open on the Highlighted tab the first time the creator's response arrives.
  const openedResponse = useRef(false);
  useEffect(() => {
    if (responded && !openedResponse.current) {
      openedResponse.current = true;
      setTab("highlights");
    }
  }, [responded, setTab]);
  const locateCount = useRef<Record<string, number>>({});
  const { decide } = useScriptActions(submissionId);
  const [confirming, setConfirming] = useState<"approve" | "send_back" | null>(null);
  const [timeline, setTimeline] = useState<Timeline>(DEFAULT_TIMELINE);
  const { mood } = usePublicMood(submissionId, true);
  const moodDecision = overallPostDecision(mood);
  // The same query the sentiment panel uses, for its tile.
  const { analysis: sentiment } = useSentiment(submissionId);

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
  /** A flag card was clicked: take the reviewer to its wording in the script (the next place each time). */
  const goToFlag = (v: ComplianceViolation, specificTerm?: string) => {
    const missing = v.kind === "MISSING_DISCLAIMER";
    const matched = v.evaluation?.matched_text?.trim();
    const candidateTerms = specificTerm
      ? [specificTerm]
      : [
          ...(matched ? [matched] : []),
          ...(missing ? [] : v.flagged_terms),
        ].filter(Boolean);

    if (mode === "edit") {
      if (candidateTerms[0]) findInScript(candidateTerms[0]);
      return;
    }
    if (compare !== "mine") setCompare("mine");
    const n = locateCount.current[v.rule_id] ?? 0;
    locateCount.current[v.rule_id] = n + 1;
    // The script may need a render first when the view just changed.
    window.setTimeout(() => {
      if (candidateTerms.length === 0 || textRef.current?.locate(candidateTerms, n) === 0) {
        textRef.current?.toEnd();
      }
    }, compare !== "mine" ? 60 : 0);
  };
  /** A highlight card was clicked: take the reviewer to that wording. */
  const goToHighlight = (id: string) => {
    const switching = compare !== "mine";
    if (switching) setCompare("mine");
    window.setTimeout(() => textRef.current?.goTo(id), switching ? 60 : 0);
  };
  /** An addressed card was clicked: go to the new wording (or the old, if it hasn't changed). */
  const goToAddressed = (h: { text: string; updated?: string | null }) => {
    const switching = compare !== "mine";
    if (switching) setCompare("mine");
    window.setTimeout(() => textRef.current?.locate([h.updated?.trim() || h.text], 0), switching ? 60 : 0);
  };
  // Disclaimers the reviewer added from a flag card. The check clears those flags, so the cards are kept here (struck
  // through) with a way to take the addition back.
  const [added, setAdded] = useState<Record<string, { v: ComplianceViolation; text: string }>>({});
  const addDisclaimer = (v: ComplianceViolation, text: string) => {
    setDraft((d) => `${d.replace(/\s+$/, "")}\n\n${text}\n`);
    setAdded((a) => ({ ...a, [v.rule_id]: { v, text } }));
    setCompare("mine");
  };
  const discardDisclaimer = (ruleId: string) => {
    const mine = added[ruleId];
    if (!mine) return;
    setDraft((d) => {
      const block = `\n\n${mine.text}\n`;
      let at = d.lastIndexOf(block);
      let len = block.length;
      if (at === -1) {
        at = d.lastIndexOf(mine.text);
        len = mine.text.length;
      }
      return at === -1 ? d : d.slice(0, at) + d.slice(at + len);
    });
    setAdded((a) => {
      const next = { ...a };
      delete next[ruleId];
      return next;
    });
  };

  // Anything highlighted or noted in this version is something to fix, so the script cannot be approved as it is.
  const marked = highlights.length > 0;
  const criticalNeedsNote = !hasEdits && verdict.critical > 0 && !hasNote;
  const sendBack = () => {
    if (!hasEdits && !hasNote) {
      setNeedNote(true);
      noteRef.current?.focus();
      return;
    }
    setTimeline(DEFAULT_TIMELINE);
    setConfirming("send_back");
  };
  // Approving asks when the video is due (a week by default, or none).
  const approve = () => {
    setTimeline({ kind: "days", days: 5 });
    setConfirming("approve");
  };
  const confirmDecision = () => {
    const due = timelineFields(timeline);
    const common = { note: noteValue.current.trim() || undefined, due_days: due.days, due_at: due.at };
    decide.mutate(
      confirming === "approve" ? { decision: "APPROVE", ...common } : { decision: "SEND_BACK", text: hasEdits ? draft : undefined, ...common },
      { onSuccess: () => setConfirming(null) }
    );
  };

  // The four things a reviewer looks at, each with its one-line answer (as on a post's review).
  const sentimentRead = sentiment?.status === "COMPLETED" && sentiment.result ? SENTIMENT_TILE[sentiment.result.overall_assessment] : null;
  const sentimentBusy = sentiment ? ["PENDING", "PROCESSING", "WAITING_TRANSCRIPT", "SCHEDULED"].includes(sentiment.status) : false;
  const flagWords = [
    verdict.critical > 0 ? `${verdict.critical} critical` : "",
    grouped.NEEDS_REVIEW.length ? `${grouped.NEEDS_REVIEW.length} to check` : "",
    grouped.EVIDENCE_REQUIRED.length ? `${grouped.EVIDENCE_REQUIRED.length} need${grouped.EVIDENCE_REQUIRED.length === 1 ? "s" : ""} a source` : "",
  ].filter(Boolean);
  const tiles: GlanceTile[] = [
    {
      key: "flags",
      label: "Flags",
      value: check?.ai_unavailable ? "No check" : active.length ? `${active.length} open` : "Nothing open",
      sub: check?.ai_unavailable ? "The check couldn't run" : flagWords.join(" · ") || (grouped.CLEARED.length ? `${grouped.CLEARED.length} cleared` : "No flags on the script"),
      tone: check?.ai_unavailable ? "muted" : verdict.critical > 0 ? "bad" : active.length ? "warn" : "ok",
      seen: seen.has("flags"),
    },
    {
      key: "highlights",
      label: "Highlighted",
      value: highlights.length ? `${highlights.length} marked` : "None",
      sub: highlights.length ? "Places you marked for changes" : "Select text in the script to mark it",
      tone: highlights.length ? "warn" : "muted",
      seen: seen.has("highlights"),
    },
    {
      key: "sentiment",
      label: "Sentiment",
      value: sentimentRead?.label ?? (sentimentBusy ? "Running" : "Not run"),
      sub: moodDecision ? `Public mood: ${moodDecision.recommendation.toLowerCase()}` : sentimentRead ? "Read on the script as sent" : sentimentBusy ? "Will appear here" : "Run it from here",
      tone: sentimentRead?.tone ?? "muted",
      seen: seen.has("sentiment"),
    },
    {
      key: "history",
      label: "History",
      value: `${versions.length} version${versions.length === 1 ? "" : "s"}`,
      sub: previous ? `Previous: version ${previous.version_number}` : "First version",
      tone: "muted",
      seen: seen.has("history"),
    },
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
            {onUploadScript && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs font-semibold text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30 bg-blue-50/50 hover:bg-blue-100"
                onClick={onUploadScript}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" /> Upload script
              </Button>
            )}
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
              <HighlightableText ref={textRef} value={shownHighlights} onChange={saveHighlights} layoutKey={draft.length}>
                <ScriptEditor ref={editorRef} value={draft} onChange={setDraft} />
              </HighlightableText>
              <p className="mt-2 text-xs text-muted-foreground">
                Edit it like a document. Switch to Read to see your changes marked against the creator's version.
                {saveHighlights && " You can still select wording to highlight it or leave a comment, as in Read."}
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
              <HighlightableText
                ref={textRef}
                value={shownHighlights}
                onChange={saveHighlights}
                layoutKey={`${compare}|${showChanges}|${draft.length}`}
              >
                <InlineDiff parts={parts} terms={compare === "mine" ? terms : []} showChanges={showChanges} focusId={focusId} onPick={setFocusId} />
              </HighlightableText>
            </article>
          )}
        </div>
      </section>

      {/* ===== Check, sentiment, history and the decision ===== */}
      <ResizablePanel
        as="aside"
        label="Your review"
        storageKey="review"
        edge="left"
        min={320}
        max={900}
        className="flex min-h-[480px] shrink-0 flex-col border-t border-border/70 lg:min-h-0 lg:border-l lg:border-t-0"
        defaultWidth="lg:w-[400px] 2xl:w-[440px] min-[112.5rem]:w-[500px]"
      >
        <div className="flex items-center gap-4 border-b border-border/70 px-5 py-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] ${verdict.ring}`}>
            {checking ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-center leading-none">
                <span className="block text-xl font-bold tabular-nums text-foreground">{check?.ai_unavailable ? "–" : check?.score ?? "–"}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Script check · {hasEdits ? "with your changes" : "as sent"}</p>
            <p className={`text-[15px] font-semibold ${verdict.tone}`}>{verdict.text}</p>
            {check?.ai_unavailable ? (
              <p className="text-sm text-muted-foreground">{AI_UNAVAILABLE_SHORT}</p>
            ) : (
            <p className="text-sm text-muted-foreground">
              {grouped.VIOLATION.length} flag{grouped.VIOLATION.length === 1 ? "" : "s"}
              {verdict.critical > 0 && ` · ${verdict.critical} critical`}
              {grouped.NEEDS_REVIEW.length > 0 && ` · ${grouped.NEEDS_REVIEW.length} to check`}
              {grouped.EVIDENCE_REQUIRED.length > 0 && ` · ${grouped.EVIDENCE_REQUIRED.length} need${grouped.EVIDENCE_REQUIRED.length === 1 ? "s" : ""} a source`}
              {grouped.CLEARED.length > 0 && ` · ${grouped.CLEARED.length} cleared`}
              {hasEdits && sent.check?.score != null && check?.score != null && !checking && ` · was ${sent.check.score}`}
            </p>
            )}
          </div>
        </div>

        <ReviewGlance tiles={tiles} active={tab} onPick={(key) => setTab(key as PanelTab)} />

        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
          {tab === "flags" &&
            (violations.length === 0 && Object.keys(added).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <CheckCircle2 className="mx-auto w-7 h-7 text-emerald-500" />
                <p className="mt-2 text-sm font-semibold text-foreground">No rulebook flags</p>
                <p className="text-xs text-muted-foreground">Nothing in this script broke a rule.</p>
              </div>
            ) : (
              <>
                {Object.values(added).length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Added to the script ({Object.values(added).length})</p>
                    {Object.values(added).map(({ v }) => (
                      <FlagCard
                        key={v.rule_id}
                        v={v}
                        canEdit={canReview}
                        added
                        onFind={findInScript}
                        onGo={(term) => goToFlag(v, term)}
                        onAddDisclaimer={(text) => addDisclaimer(v, text)}
                        onDiscard={() => discardDisclaimer(v.rule_id)}
                      />
                    ))}
                  </div>
                )}
                {FINDING_ORDER.map((status) => {
                  const shown = grouped[status].filter((v) => !added[v.rule_id]);
                  return (
                    <FindingGroup key={status} status={status} count={shown.length}>
                      {shown.map((v) => (
                        <FlagCard
                          key={v.rule_id}
                          v={v}
                          canEdit={canReview}
                          onFind={findInScript}
                          onGo={(term) => goToFlag(v, term)}
                          onAddDisclaimer={(text) => addDisclaimer(v, text)}
                          onDiscard={() => discardDisclaimer(v.rule_id)}
                        />
                      ))}
                    </FindingGroup>
                  );
                })}
              </>
            ))}

          {tab === "highlights" && (
            <>
              {responded && (
                <>
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    The creator's response to your last review ({earlier.filter((h) => h.done).length}/{earlier.length} done)
                  </p>
                  <AddressedCards highlights={earlier} onPick={goToAddressed} />
                  <p className="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">This version ({highlights.length})</p>
                </>
              )}
              <HighlightCards
                highlights={highlights}
                onPick={goToHighlight}
                empty="Select wording in the script to highlight it or leave a note. They show here, and the creator sees them too."
              />
            </>
          )}

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
            <NoteField
              id="script-note"
              ref={noteRef}
              valueRef={noteValue}
              onHasText={onNoteText}
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
                : marked
                ? `You marked ${highlights.length} place${highlights.length === 1 ? "" : "s"} in this version. Request changes, or remove the highlights to approve.`
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
                title={!hasEdits && !hasNote ? "A comment is required to request changes" : undefined}
                onClick={sendBack}
              >
                {decide.isPending && decide.variables?.decision === "SEND_BACK" && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasEdits ? "Send back with edits" : "Request changes"}
              </Button>
              <Button
                variant={hasEdits ? "outline" : "default"}
                className="h-10 flex-1"
                disabled={decide.isPending || hasEdits || criticalNeedsNote || marked || Boolean(check?.ai_unavailable)}
                title={
                  check?.ai_unavailable
                    ? "The AI review couldn't run, so there's no score yet. It's re-checked automatically."
                    : marked
                    ? "You highlighted or commented on this version. Request changes instead"
                    : hasEdits
                    ? "You changed the script, so the creator accepts it first"
                    : criticalNeedsNote
                    ? "Say in the note why the critical flag is fine"
                    : undefined
                }
                onClick={approve}
              >
                {decide.isPending && decide.variables?.decision === "APPROVE" && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve script
              </Button>
            </div>
            <Dialog open={confirming !== null} onOpenChange={(open) => !open && !decide.isPending && setConfirming(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{confirming === "approve" ? "Approve the script" : hasEdits ? "Send the script back with your edits" : "Request changes to the script"}</DialogTitle>
                  <DialogDescription>
                    {confirming === "approve"
                      ? "The creator is told it's approved and when the video is due."
                      : "The creator is told what to change and when it's due, then sends it back to you."}
                  </DialogDescription>
                </DialogHeader>
                <RevisionTimelinePicker
                  value={timeline}
                  onChange={setTimeline}
                  label={confirming === "approve" ? "Video due by" : "Time to make the changes"}
                  allowNone={confirming === "approve"}
                />
                <DialogFooter>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirming(null)} disabled={decide.isPending}>
                    Cancel
                  </Button>
                  <Button size="sm" className="text-xs gap-1.5" onClick={confirmDecision} disabled={decide.isPending || !timelineValid(timeline)}>
                    {decide.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {confirming === "approve" ? "Approve script" : hasEdits ? "Send back with edits" : "Request changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
      </ResizablePanel>
    </>
  );
}

export function FlagCard({
  v,
  canEdit,
  onFind,
  onGo,
  onAddDisclaimer,
  onDiscard,
  added = false,
}: {
  v: ComplianceViolation;
  canEdit: boolean;
  /** The reviewer added this flag disclaimer to the script: show the card struck through. */
  added?: boolean;
  /** Take that addition back. */
  onDiscard?: () => void;
  onFind?: (term: string) => void;
  /** Go to this flag's wording in the script. Without it (as on the creator's page) the card finds the wording
   * wherever it's shown on the page instead, like "Read in context" does. */
  onGo?: (specificTerm?: string) => void;
  onAddDisclaimer?: (text: string) => void;
}) {
  const critical = v.traffic_light === "RED";
  const missing = v.kind === "MISSING_DISCLAIMER";
  const cleared = statusOf(v) === "CLEARED";
  const struck = added ? "line-through decoration-muted-foreground/70" : "";
  const [notShown, setNotShown] = useState(false);
  const matched = v.evaluation?.matched_text?.trim();
  const pageTerms = [...(matched ? [matched] : []), ...(missing ? [] : v.flagged_terms)].filter(Boolean);
  const canGo = Boolean(onGo || pageTerms.length);
  /** Go to the wording: in the script viewer when there is one, otherwise wherever it's shown on the page (the next
   * place it appears each click), skipping this card's own copy of it. */
  const go = (card: Element | null, specificTerm?: string) => {
    if (onGo) {
      onGo(specificTerm);
      return;
    }
    setNotShown(!(specificTerm ? [specificTerm] : pageTerms).some((t) => locateOnPage(t, card)));
  };
  return (
    <article
      role={canGo ? "button" : undefined}
      tabIndex={canGo ? 0 : undefined}
      title={canGo ? (onGo ? "Show in the script" : "Show this wording on the page") : undefined}
      onClick={canGo ? (e) => go(e.currentTarget) : undefined}
      onKeyDown={(e) => {
        if (canGo && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          go(e.currentTarget);
        }
      }}
      className={`flex flex-col gap-2 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${canGo ? "cursor-pointer hover:border-sky-400/70 hover:bg-muted/30" : ""} ${cleared || added ? "opacity-80" : ""}`}
    >
      <div className="flex items-center gap-2">
        <StatusPill status={statusOf(v)} critical={critical} />
        <span className="text-xs text-muted-foreground">{missing ? "Missing disclaimer" : "In the script"}</span>
      </div>
      <div>
        <RuleNumberBadge v={v} />
        <p className={`mt-1 text-sm font-semibold text-foreground ${struck}`}>{v.title}</p>
      </div>
      {v.evaluation ? (
        <ContextNote
          v={v}
          onLocate={
            // Without a script viewer the note finds the wording on the page itself (skipping this card).
            onGo
              ? (term) => {
                  onGo(term || undefined);
                }
              : undefined
          }
        />
      ) : (
        <p className={`text-[13px] text-foreground/80 ${struck}`}>{v.explanation}</p>
      )}
      {!missing && !cleared && v.flagged_terms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {v.flagged_terms.map((t) => (
            <button
              key={t}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Reviewers edit it in the script; everyone else is taken to this word.
                if (canEdit) onFind?.(t);
                else go(e.currentTarget.closest("article"), t);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-200"
              title={canEdit ? "Find it in the script and edit it" : "Show this wording"}
            >
              {canEdit && <Search className="w-3 h-3" />}“{t}”
            </button>
          ))}
        </div>
      )}
      {v.remediation_guidance && !cleared && (
        <p className={`text-[13px] text-foreground/80 ${struck}`}>
          <span className="font-semibold">{isWarning(v) ? "What to check:" : "How to fix:"}</span> {v.remediation_guidance}
        </p>
      )}
      {notShown && <p className="text-xs text-amber-700 dark:text-amber-400">This wording isn't shown on this page right now.</p>}
      {missing && (added || !cleared) && canEdit && (v.missing_disclaimers?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className={`rounded-lg bg-muted px-2.5 py-1.5 text-xs text-foreground/80 ${struck}`}>“{v.missing_disclaimers![0]}”</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={added}
              onClick={(e) => {
                e.stopPropagation();
                onAddDisclaimer?.(v.missing_disclaimers![0]);
              }}
            >
              {added ? "Added to the end of the script" : "Add it to the end of the script"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={!added}
              onClick={(e) => {
                e.stopPropagation();
                onDiscard?.();
              }}
            >
              Discard changes
            </Button>
          </div>
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
