import CreatorFlagOutcomes, { InlineFlagOutcome } from "@/components/submissions/CreatorFlagOutcomes";
import CompliancePreviewActions from "@/components/submissions/CompliancePreviewActions";
import GroupedComplianceFindings, { FindingsHeader } from "@/components/submissions/GroupedComplianceFindings";
import { previewFindings } from "@/lib/rule18Presentation";
import { pendingCheckProgress } from "@/lib/pendingCheckProgress";
import ComplianceScoreSummary from "@/components/submissions/ComplianceScoreSummary";
import StaleComplianceNotice from "@/components/submissions/StaleComplianceNotice";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import CheckCoverage from "@/components/submissions/CheckCoverage";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import PostTextPreview from "@/components/submissions/PostTextPreview";
import { isVisibleFinding } from "@/lib/complianceFinding";
import { findingEvidence } from "@/lib/findingEvidence";
import { ConfidenceBadge, ContextNote, FINDING_META, statusOf } from "@/components/submissions/FindingStatus";
import { FindingExplanation } from "@/components/submissions/FindingExplanation";
import FlaggedVideo from "@/components/submissions/FlaggedVideo";
import ManuallyCheckedClaims, { useManuallyCheckedClaims } from "@/components/submissions/ManuallyCheckedClaims";
import MarkedUpImageSlideshow from "@/components/submissions/MarkedUpImageSlideshow";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import ScoreBreakdown from "@/components/submissions/ScoreBreakdown";
import UnavailableCompliance, { IncompleteFindingsNotice } from "@/components/submissions/UnavailableCompliance";
import SyntheticMediaFixNote from "@/components/submissions/SyntheticMediaFixNote";
import VideoTranscript from "@/components/submissions/VideoTranscript";
import { SourceCheckingNotice, SourcesCheckedSection } from "@/components/submissions/SourceChecks";
import { authedFileUrl, isAnalysing } from "@/components/submissions/submissionUi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { useReviewSendScore } from "@/hooks/useReviewSendScore";
import { findingSelectionKey, selectFindingImage } from "@/lib/findingImage";
import { useImageSlideshow } from "@/hooks/useImageSlideshow";
import { FlaggedMoments, timelineOf } from "@/pages/Compliance/ContentScreenerPage";
import type { ComplianceViolation } from "@/services/complianceService";
import type { Submission, SubmissionFile } from "@/types/submission";

const DEFAULT_MIN_SCORE = 90;

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Finding {
  v: ComplianceViolation;
  key: string;
  /** Where in the post it was found. */
  where: "Text" | "Script" | "Title" | "Video" | "Image or on-screen text" | "Missing disclaimer";
  /** The first moment of the video it was found at. */
  at: number | null;
  /** The final matching moment, so video evidence can show its complete range. */
  until: number | null;
  /** Number of video frames with a saved, tight visual region for this rule. */
  frameCount: number;
}

function timecode(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function videoEvidence(finding: Finding) {
  if (finding.where !== "Video" || finding.at == null) return finding.where;
  const range = `${timecode(finding.at)} – ${timecode(finding.until ?? finding.at)}`;
  return `Video · ${range}${finding.frameCount ? ` · found in ${finding.frameCount} frame${finding.frameCount === 1 ? "" : "s"}` : ""}`;
}

/**
 * The creator's compliance step, laid out like the design: the score and what cost points on the left, with the
 * findings you can click, and your post on the right with the flagged wording marked (and, for a video, the flagged
 * moments along its timeline, as the reviewer sees them).
 */
export default function ComplianceStep({
  sub,
  reviewState,
  title,
  caption,
  captionHtml,
  scriptText = "",
  textOnly = false,
  mainFile,
  files,
  editable,
  checking,
  stale,
  progress,
  extra,
  sourceChecking,
  onCheck,
  onEditCaption,
  onReplaceMedia,
}: {
  sub: Submission | null;
  reviewState: Submission | null;
  title: string;
  caption: string;
  captionHtml?: string;
  scriptText?: string;
  textOnly?: boolean;
  mainFile?: SubmissionFile;
  files?: SubmissionFile[];
  editable: boolean;
  checking: boolean;
  stale: boolean;
  /** Shown while a check runs. */
  progress?: ReactNode;
  /** Shown under the score (which models read it). */
  extra?: ReactNode;
  /** Active background source checks (image source scan or link quick-check). */
  sourceChecking?: string[];
  onCheck: () => void;
  onEditCaption: () => void;
  onReplaceMedia: () => void;
}) {
  const { user } = useAuth();
  const check = sub?.latest_check ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [clearedOpen, setClearedOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const slideshow = useImageSlideshow(files ?? sub?.files ?? (mainFile ? [mainFile] : []));

  const ownsSubmission = Boolean(user && reviewState?.created_by === user.id);
  const reviewRoutingScore = useReviewSendScore(ownsSubmission ? sub?.id ?? null : null, check, sub?.current_version ?? 0);
  const isManuallyChecked = useManuallyCheckedClaims(ownsSubmission ? sub?.id : undefined, check);
  const checkedClaims = check?.violations.filter(isManuallyChecked) ?? [];
  const allFindings: Finding[] = useMemo(() => {
    if (!check) return [];
    const cap = caption.toLowerCase();
    const ttl = title.toLowerCase();
    return check.violations
      .filter((v) => isVisibleFinding(v) && statusOf(v) !== "CLEARED")
      .map((v, index) => {
        const videoSegments = (check.segment_flags ?? [])
          .filter((f) => f.rule_numbers.includes(v.rule_number))
          .sort((a, b) => a.start_sec - b.start_sec);
        const seg = videoSegments[0];
        const frameCount = new Set((v.image_regions ?? [])
          .filter((r) => r.file_id === mainFile?.id && r.start_sec != null && r.end_sec != null)
          .map((r) => `${r.start_sec}-${r.end_sec}`)).size;
        const terms = findingEvidence(v).map((t) => t.toLowerCase());
        const where: Finding["where"] = v.category === "Video disclosure" ? "Video" : terms.some((t) => scriptText.toLowerCase().includes(t)) ? "Script" : terms.some((t) => cap.includes(t))
          ? "Text"
          : seg
          ? "Video"
          : terms.some((t) => ttl.includes(t))
          ? "Title"
          : v.kind === "MISSING_DISCLAIMER"
          ? "Missing disclaimer"
          : "Image or on-screen text";
        return { v, key: findingSelectionKey(v, index), where, at: seg ? seg.start_sec : null,
          until: videoSegments.at(-1)?.end_sec ?? null, frameCount };
      })
      .sort((a, b) => Number(b.v.traffic_light === "RED") - Number(a.v.traffic_light === "RED") || (a.at ?? 1e9) - (b.at ?? 1e9));
  }, [check, caption, title, scriptText, mainFile?.id]);
  const findings = allFindings.filter((finding) => !isManuallyChecked(finding.v));
  const cleared = check?.violations.filter((v) => statusOf(v) === "CLEARED") ?? [];

  const isVideo = Boolean(mainFile?.mime_type.startsWith("video/"));
  const checkedVideo = sub?.files.find((file) => file.id === mainFile?.id);
  const canRequestDismissal = ownsSubmission && (editable || reviewState?.status === "IN_REVIEW");
  const canDismiss = !ownsSubmission && reviewState?.can_review === true;
  const parts = check ? timelineOf(sub!, duration) : [];
  const selected = findings.find((f) => f.key === picked) ?? null;

  const seek = (t: number) => {
    const el = videoRef.current;
    if (el) {
      el.currentTime = t;
      el.pause();
    }
    setNow(t);
  };
  const pick = (f: Finding) => {
    const imageFinding = !isVideo && f.where === "Image or on-screen text";
    const next = !imageFinding && picked === f.key ? null : f.key;
    setPicked(next);
    if (imageFinding && !selectFindingImage(f.v, slideshow, check?.violations)) toast.info("The saved check does not identify which image to open for this finding.");
    if (next && isVideo && f.at != null) seek(f.at);
  };

  const highlightedFindings = previewFindings(findings, picked);
  const terms = (list: Finding[]) => list.flatMap((f) => findingEvidence(f.v));
  const captionParts = (() => {
    const all = terms(highlightedFindings);
    const preview = caption;
    if (!all.length || !preview) return [{ text: preview, tone: "" }];
    const chosen = new Set(selected ? findingEvidence(selected.v).map((t) => t.toLowerCase()) : []);
    return preview
      .split(new RegExp(`(${all.map(escapeRe).join("|")})`, "gi"))
      .map((text, i) => ({ text, tone: i % 2 ? (chosen.has(text.toLowerCase()) ? "chosen" : "flag") : "" }));
  })();
  const mediaFindings = highlightedFindings.filter((f) => f.v.image_regions?.length || f.where === "Image or on-screen text" || f.where === "Video");

  const header = (
    <div className="@container/compliance-header">
      <div className="grid gap-4 @[34rem]/compliance-header:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-foreground">Compliance check</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Regulatory, legal and brand rules for the rule sets, audience and region you picked.
            </p>
          </div>
        </div>
        {editable && (
          <div className="flex flex-col items-start gap-1.5 pl-[52px] @[34rem]/compliance-header:items-end @[34rem]/compliance-header:pl-0">
            <Button
              type="button"
              variant="default"
              onClick={() => onCheck()}
              disabled={checking}
              className="h-10 shrink-0 gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : check ? <RefreshCw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {check ? "Check again" : "Run compliance check"}
            </Button>
            <span className="text-xs leading-relaxed text-muted-foreground">Run again after editing.</span>
          </div>
        )}
      </div>
    </div>
  );

  const card = "rounded-2xl border border-border/70 bg-card p-5 shadow-xs sm:p-6";

  // ---- not checked yet, or checking
  if (checking || !check) {
    return (
      <div className={`${card} flex flex-col gap-4`}>
        {header}
        {checking ? (
          progress
        ) : (
          <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Not checked yet. Run it to see your score and anything a reviewer would flag; it saves your draft first.
          </p>
        )}
        <SourceCheckingNotice items={sourceChecking} />
      </div>
    );
  }

  const analysing = isAnalysing(check);
  const processing = pendingCheckProgress(check, sub?.files ?? files ?? []);
  const pendingScore = (
    <div role="status" className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:gap-6 sm:p-5">
      <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-8 border-muted bg-card" aria-hidden="true">
        <Loader2 className="h-8 w-8 text-primary motion-safe:animate-spin" />
      </span>
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <p className="text-base font-bold text-foreground">{processing.label}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{processing.description}</p>
      </div>
    </div>
  );
  const score = check.score;
  const minimumScore = Math.max(DEFAULT_MIN_SCORE, reviewState?.min_approval_score ?? 0);
  const gap = score - minimumScore;
  const count = (s: string) => findings.filter(({ v }) => statusOf(v) === s).length;
  const headline = [
    count("VIOLATION") ? `${count("VIOLATION")} issue${count("VIOLATION") === 1 ? "" : "s"} to fix` : "",
    count("EVIDENCE_REQUIRED") ? `${count("EVIDENCE_REQUIRED")} claim${count("EVIDENCE_REQUIRED") === 1 ? "" : "s"} need${count("EVIDENCE_REQUIRED") === 1 ? "s" : ""} a source` : "",
    count("NEEDS_REVIEW") ? `${count("NEEDS_REVIEW")} thing${count("NEEDS_REVIEW") === 1 ? "" : "s"} to check` : "",
  ].filter(Boolean);
  const advice = !stale && score < minimumScore && reviewRoutingScore != null && reviewRoutingScore >= minimumScore ? `Your score remains ${score}/100. You can send this post for review so a reviewer can decide your dismissal requests. Approval still requires ${minimumScore} or more and no critical issue.` : check.blocked
    ? "A critical rule is broken, so this post can't be sent until that's fixed."
    : gap >= 0
    ? `A post needs ${minimumScore} or more, and no critical issue, to be sent. You are ${gap} point${gap === 1 ? "" : "s"} above the line${findings.length ? ", and the fixes below will raise it" : ""}.`
    : `A post needs ${minimumScore} or more, and no critical issue, to be sent. You are ${-gap} point${gap === -1 ? "" : "s"} under the line: fix the findings below and check again.`;

  const scoreHeading = stale || check.ai_unavailable ? "Provisional score" : headline.length ? headline.join(", ") : checkedClaims.length ? "Claims checked by you" : "No issues found";
  const scoreAdvice = stale || check.ai_unavailable ? "Based on the findings available from this check." : advice;
  const routingScore = stale ? undefined : reviewRoutingScore;
  const scoreSummary = (
    <ComplianceScoreSummary score={score} minimumScore={minimumScore} heading={scoreHeading}
      description={scoreAdvice} recalculatedScore={routingScore} provisional={Boolean(stale || check.ai_unavailable)} />
  );
  return (
    <div className={`grid grid-cols-1 items-start gap-4 sm:gap-5 ${scriptText ? "2xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.4fr)]" : "xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]"}`}>
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <section className={`${card} flex flex-col gap-4`}>
          {header}
          {analysing ? pendingScore : scoreSummary}
          {stale ? <StaleComplianceNotice /> : check.ai_unavailable && <UnavailableCompliance check={check} />}
          {extra}
          <CheckCoverage check={check} />
          {!analysing && <ScoreBreakdown check={check} provisional={stale} />}
        </section>

        {ownsSubmission && reviewState && <CreatorFlagOutcomes submissionId={reviewState.id} currentVersion={reviewState.current_version} />}
        <section className={`${card} flex flex-col gap-3`}>
          <FindingsHeader stale={stale} hasFindings={findings.length > 0} />
          {!stale && !check.ai_unavailable && !analysing && findings.length === 0 && checkedClaims.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <Check className="h-4 w-4" strokeWidth={3} /> Nothing to fix in the text we could check.
            </p>
          )}
          {!stale && check.ai_unavailable && !analysing && findings.length === 0 && <IncompleteFindingsNotice />}
          <GroupedComplianceFindings findings={findings} onClose={() => setPicked(null)} renderFinding={(f, i) => {
            const st = statusOf(f.v);
            const critical = f.v.traffic_light === "RED";
            const on = f.key === picked;
            const tone = critical || st === "VIOLATION" ? "red" : "amber";
            const edit = f.where === "Text" || f.where === "Title";
            return (
              <article
                key={f.key}
                className={`overflow-hidden rounded-2xl border-2 transition-colors ${
                  on
                    ? tone === "red"
                      ? "border-red-500 bg-red-50/60 dark:bg-red-500/10"
                      : "border-amber-500 bg-amber-50/60 dark:bg-amber-500/10"
                    : "border-border/70 bg-card hover:border-border"
                }`}
              >
                <button type="button" aria-pressed={on} onClick={() => pick(f)} className="flex w-full gap-3.5 p-4 text-left">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white ${tone === "red" ? "bg-red-600" : "bg-amber-600"}`}>
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${FINDING_META[st].pill}`}>{st === "VIOLATION" ? "Issue" : FINDING_META[st].label}</span>
                      <RuleNumberBadge v={f.v} /><ConfidenceBadge v={f.v} />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {videoEvidence(f)}
                      </span>
                      <span className={`ml-auto text-[13px] font-bold tabular-nums ${tone === "red" ? "text-red-600" : "text-amber-700 dark:text-amber-300"}`}>
                        {(f.v.penalty ?? 0) > 0 ? `−${f.v.penalty} points` : "No points"}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold leading-snug text-foreground">{f.v.title}</span>
                  </span>
                </button>
                <FindingExplanation v={f.v} />
                {ownsSubmission && reviewState && f.v.rule_id && <InlineFlagOutcome submissionId={reviewState.id} ruleId={f.v.rule_id} currentVersion={reviewState.current_version} />}
                {on && (
                  <div className="flex flex-col gap-2.5 px-4 pb-4 pl-[58px]">
                    <SyntheticMediaFixNote finding={f.v} />
                    {editable && (!textOnly || edit) && (
                      <Button type="button" variant="outline" size="sm" className="self-start rounded-lg text-[13px] font-semibold text-blue-700" onClick={edit ? onEditCaption : onReplaceMedia}>
                        {f.where === "Script" ? "Replace the script" : edit ? "Edit text" : f.where === "Video" ? "Edit the video" : "Fix in image"}
                      </Button>
                    )}
                    {reviewState && (canRequestDismissal || canDismiss) && f.v.rule_id && <FlagReviewControl submissionId={reviewState.id} ruleId={f.v.rule_id} ruleNumber={f.v.rule_number} currentVersion={reviewState.current_version} canDismiss={canDismiss} canRequest={canRequestDismissal} evidence={f.v.status === "EVIDENCE_REQUIRED"} />}
                  </div>
                )}
              </article>
            );
          }} />
          <ManuallyCheckedClaims findings={checkedClaims} />
          {cleared.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] leading-relaxed text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <button
                type="button"
                aria-expanded={clearedOpen}
                onClick={() => setClearedOpen((o) => !o)}
                className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} />
                <span className="min-w-0 flex-1">
                  <strong className="font-semibold">{cleared.length} cleared.</strong> The wording or supporting evidence resolved these findings. No points were taken off.
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                  {clearedOpen ? "Hide details" : "How?"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${clearedOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {clearedOpen && (
                <ul className="flex flex-col gap-3 border-t border-emerald-200 px-3.5 py-3 dark:border-emerald-500/30">
                  {cleared.map((v) => {
                    const e = v.evaluation;
                    return (
                      <li key={`${v.rule_id}-${v.kind ?? ""}`} className="flex flex-col gap-2 rounded-lg border border-emerald-200/80 bg-card p-3 text-foreground dark:border-emerald-500/30">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">Cleared</span>
                          <RuleNumberBadge v={v} />
                          <span className="text-sm font-semibold">{v.title}</span>
                        </p>
                        {v.flagged_terms.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            What matched: {v.flagged_terms.map((t) => `“${t}”`).join(", ")}
                          </p>
                        )}
                        {v.passage && (
                          <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground/85">
                            <span className="font-semibold">The sentence it sits in:</span> {v.passage}
                          </p>
                        )}
                        <ContextNote v={v} />
                        {e?.recommended_action && (
                          <p className="text-xs text-foreground/80">
                            <span className="font-semibold">Note:</span> {e.recommended_action}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {e
                            ? e.source === "UNAVAILABLE"
                              ? "No model could read this one, so the rule's own answer stands."
                              : e.source === "ADJUSTED"
                              ? `Read by ${e.model ?? "a model"}, then adjusted by a safeguard (low confidence, or wording that isn't in the post).`
                              : `Read by ${e.model ?? "a model"} and judged in context.`
                            : "Cleared before the context reading was recorded, so there are no details."}
                          {v.explanation ? ` Rule: ${v.explanation}` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>

        <SourcesCheckedSection checks={check.source_checks} savedChecks={sub?.source_link_checks} checking={sourceChecking} submissionId={sub?.id} editable={editable} className={`${card} flex flex-col gap-3`} />
      </div>

      <aside className="flex min-w-0 flex-col gap-4 sm:gap-5 xl:sticky xl:top-4">
        <section className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Your post, marked up</h2>
            {mainFile && isVideo && <span className="text-[11px] text-muted-foreground">Video</span>}
          </div>
          {mainFile && isVideo && (
            <>
              <FlaggedVideo src={authedFileUrl(mainFile.url)} fileId={mainFile.id} videoRef={videoRef} findings={mediaFindings.map((f) => f.v)} currentTime={now} onTime={setNow} onDuration={setDuration} onPlaying={setPlaying} />
              <FlaggedMoments
                parts={parts}
                now={now}
                duration={duration || Math.max(0, ...(check.segment_flags ?? []).map((f) => f.end_sec))}
                playing={playing}
                onToggle={() => {
                  const el = videoRef.current;
                  if (el) void (el.paused ? el.play() : el.pause());
                }}
                onStep={(by) => seek(Math.max(0, now + by))}
                seek={seek}
              />
              <VideoTranscript file={checkedVideo ?? mainFile} check={stale || !checkedVideo ? null : check} now={now} seek={seek} />
            </>
          )}
          {!isVideo && <MarkedUpImageSlideshow slideshow={slideshow} findings={mediaFindings.map((f) => f.v)} sourceRegions={stale ? [] : (check?.source_regions ?? [])} disclaimerRegions={stale ? [] : (check?.disclaimer_regions ?? [])} />}

          <PostTextPreview scriptText={scriptText} captionParts={captionParts} captionHtml={captionHtml ?? sub?.caption_html ?? undefined} terms={terms(highlightedFindings.filter((f) => f.where === "Script"))} />
          {selected && (
            <p className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-[13px] text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Rule {selected.v.rule_number}: found in {selected.where === "Text" ? "the text" : selected.where === "Video" ? "the video" : selected.where.toLowerCase()}.
              </span>
            </p>
          )}
          {editable && (
            <CompliancePreviewActions textOnly={textOnly} script={Boolean(scriptText)} video={isVideo} onEditText={onEditCaption} onReplaceMedia={onReplaceMedia} />
          )}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
          <h2 className="text-base font-bold text-foreground">How the score works</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>Every post starts at 100.</li>
            <li>A broken rule takes off 10 to 35 points. A claim that needs a source takes off 5.</li>
            <li>Approval needs {minimumScore} or more and no critical issue.</li>
            <li>Fix an issue and check again: the score updates.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
