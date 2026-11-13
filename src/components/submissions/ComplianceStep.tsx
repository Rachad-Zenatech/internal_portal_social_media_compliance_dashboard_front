import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import CheckCoverage from "@/components/submissions/CheckCoverage";
import { ContextNote, FINDING_META, statusOf } from "@/components/submissions/FindingStatus";
import RuleNumberBadge from "@/components/submissions/RuleNumberBadge";
import ScoreBreakdown from "@/components/submissions/ScoreBreakdown";
import SourceChecks from "@/components/submissions/SourceChecks";
import { AI_UNAVAILABLE_MESSAGE, authedFileUrl, isAnalysing } from "@/components/submissions/submissionUi";
import { Button } from "@/components/ui/button";
import { FlaggedMoments, timelineOf } from "@/pages/Compliance/ContentScreenerPage";
import type { ComplianceViolation } from "@/services/complianceService";
import type { Submission, SubmissionFile } from "@/types/submission";

const MIN_SCORE = 70;

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Finding {
  v: ComplianceViolation;
  key: string;
  /** Where in the post it was found. */
  where: "Caption" | "Title" | "Video" | "Image or on-screen text" | "Missing disclaimer";
  /** The first moment of the video it was found at. */
  at: number | null;
}

function ring(score: number) {
  return score >= 85 ? "#059669" : score >= MIN_SCORE ? "#D97706" : "#DC2626";
}

/**
 * The creator's compliance step, laid out like the design: the score and what cost points on the left, with the
 * findings you can click, and your post on the right with the flagged wording marked (and, for a video, the flagged
 * moments along its timeline, as the reviewer sees them).
 */
export default function ComplianceStep({
  sub,
  title,
  caption,
  mainFile,
  editable,
  checking,
  stale,
  progress,
  extra,
  onCheck,
  onEditCaption,
  onReplaceMedia,
}: {
  sub: Submission | null;
  title: string;
  caption: string;
  mainFile?: SubmissionFile;
  editable: boolean;
  checking: boolean;
  stale: boolean;
  /** Shown while a check runs. */
  progress?: ReactNode;
  /** Shown under the score (which models read it). */
  extra?: ReactNode;
  onCheck: () => void;
  onEditCaption: () => void;
  onReplaceMedia: () => void;
}) {
  const check = sub?.latest_check ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [clearedOpen, setClearedOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  const findings: Finding[] = useMemo(() => {
    if (!check) return [];
    const cap = caption.toLowerCase();
    const ttl = title.toLowerCase();
    return check.violations
      .filter((v) => statusOf(v) !== "CLEARED")
      .map((v) => {
        const seg = (check.segment_flags ?? [])
          .filter((f) => f.rule_numbers.includes(v.rule_number))
          .sort((a, b) => a.start_sec - b.start_sec)[0];
        const terms = v.flagged_terms.map((t) => t.toLowerCase());
        const where: Finding["where"] = terms.some((t) => cap.includes(t))
          ? "Caption"
          : seg
          ? "Video"
          : terms.some((t) => ttl.includes(t))
          ? "Title"
          : v.kind === "MISSING_DISCLAIMER"
          ? "Missing disclaimer"
          : "Image or on-screen text";
        return { v, key: `${v.rule_id}-${v.kind ?? ""}`, where, at: seg ? seg.start_sec : null };
      })
      .sort((a, b) => Number(b.v.traffic_light === "RED") - Number(a.v.traffic_light === "RED") || (a.at ?? 1e9) - (b.at ?? 1e9));
  }, [check, caption, title]);
  const cleared = check?.violations.filter((v) => statusOf(v) === "CLEARED") ?? [];

  const isVideo = Boolean(mainFile?.mime_type.startsWith("video/"));
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
    const next = picked === f.key ? null : f.key;
    setPicked(next);
    if (next && f.at != null) seek(f.at);
  };

  const terms = (list: Finding[]) => list.flatMap((f) => f.v.flagged_terms).filter(Boolean);
  const captionParts = (() => {
    const all = terms(findings);
    if (!all.length || !caption) return [{ text: caption, tone: "" }];
    const chosen = new Set(selected ? selected.v.flagged_terms.map((t) => t.toLowerCase()) : []);
    return caption
      .split(new RegExp(`(${all.map(escapeRe).join("|")})`, "gi"))
      .map((text, i) => ({ text, tone: i % 2 ? (chosen.has(text.toLowerCase()) ? "chosen" : "flag") : "" }));
  })();
  const imageTerms = findings.filter((f) => f.where === "Image or on-screen text");

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
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
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant={check && !stale ? "outline" : "default"}
            onClick={onCheck}
            disabled={checking}
            className={`h-10 gap-2 rounded-xl px-4 text-sm font-semibold ${check && !stale ? "" : "bg-blue-700 text-white hover:bg-blue-800"}`}
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : check ? <RefreshCw className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {check ? "Check again" : "Run compliance check"}
          </Button>
          <span className="text-xs text-muted-foreground">Run it as often as you like</span>
        </div>
      )}
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
      </div>
    );
  }

  const analysing = isAnalysing(check);
  const unavailable = check.ai_unavailable;
  const score = check.score;
  const gap = score - MIN_SCORE;
  const count = (s: string) => check.violations.filter((v) => statusOf(v) === s).length;
  const headline = [
    count("VIOLATION") ? `${count("VIOLATION")} issue${count("VIOLATION") === 1 ? "" : "s"} to fix` : "",
    count("EVIDENCE_REQUIRED") ? `${count("EVIDENCE_REQUIRED")} claim${count("EVIDENCE_REQUIRED") === 1 ? "" : "s"} need${count("EVIDENCE_REQUIRED") === 1 ? "s" : ""} a source` : "",
    count("NEEDS_REVIEW") ? `${count("NEEDS_REVIEW")} thing${count("NEEDS_REVIEW") === 1 ? "" : "s"} to check` : "",
  ].filter(Boolean);
  const advice = check.blocked
    ? "A critical rule is broken, so this post can't be sent until that's fixed."
    : gap >= 0
    ? `A post needs ${MIN_SCORE} or more, and no critical issue, to be sent. You are ${gap} point${gap === 1 ? "" : "s"} above the line${findings.length ? ", and the fixes below will raise it" : ""}.`
    : `A post needs ${MIN_SCORE} or more, and no critical issue, to be sent. You are ${-gap} point${gap === -1 ? "" : "s"} under the line: fix the findings below and check again.`;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <section className={`${card} flex flex-col gap-4`}>
          {header}
          {stale && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <strong className="font-semibold">You've edited the post since this check.</strong> Check again to see the score for your latest changes.
            </p>
          )}
          {unavailable ? (
            <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{AI_UNAVAILABLE_MESSAGE}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/60 bg-muted/30 p-4 sm:gap-6 sm:p-5">
              <span
                title={`Score ${score} out of 100`}
                style={{ background: `conic-gradient(${ring(score)} ${score * 3.6}deg, var(--muted) 0)` }}
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
              >
                <span className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-card leading-none">
                  <span className="text-3xl font-extrabold tabular-nums text-foreground">{analysing ? "…" : score}</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">of 100</span>
                </span>
              </span>
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                <p className="text-base font-bold text-foreground">{headline.length ? headline.join(", ") : "No issues found"}</p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{advice}</p>
                <div className="relative mt-1 h-2.5 rounded-full bg-muted">
                  <span className="absolute left-0 top-0 h-2.5 rounded-full" style={{ width: `${score}%`, background: ring(score) }} />
                  <span className="absolute -top-1 h-4.5 w-0.5 bg-foreground" style={{ left: `${MIN_SCORE}%`, height: 18 }} />
                </div>
                <span className="text-[11px] text-muted-foreground" style={{ marginLeft: `${MIN_SCORE - 4}%` }}>
                  Minimum {MIN_SCORE}
                </span>
              </div>
            </div>
          )}
          {extra}
          <CheckCoverage check={check} />
          <ScoreBreakdown check={check} />
        </section>

        <section className={`${card} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-foreground">What the check found</h2>
            {findings.length > 0 && <span className="text-xs text-muted-foreground">Click a rule to see where it is on your post</span>}
          </div>
          {findings.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <Check className="h-4 w-4" strokeWidth={3} /> Nothing to fix in the text we could check.
            </p>
          )}
          {findings.map((f, i) => {
            const st = statusOf(f.v);
            const critical = f.v.traffic_light === "RED";
            const on = f.key === picked;
            const tone = critical || st === "VIOLATION" ? "red" : "amber";
            const edit = f.where === "Caption" || f.where === "Title" || f.where === "Missing disclaimer";
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
                      <RuleNumberBadge v={f.v} />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {f.where}
                        {f.where === "Video" && f.at != null ? ` · ${Math.floor(f.at / 60)}:${String(Math.floor(f.at % 60)).padStart(2, "0")}` : ""}
                      </span>
                      <span className={`ml-auto text-[13px] font-bold tabular-nums ${tone === "red" ? "text-red-600" : "text-amber-700 dark:text-amber-300"}`}>
                        {(f.v.penalty ?? 0) > 0 ? `−${f.v.penalty} points` : "No points"}
                      </span>
                    </span>
                    <span className="text-[15px] font-semibold leading-snug text-foreground">{f.v.title}</span>
                  </span>
                </button>
                {on && (
                  <div className="flex flex-col gap-2.5 px-4 pb-4 pl-[58px]">
                    {f.v.flagged_terms.length > 0 && (
                      <p className="rounded-lg border border-border/70 bg-card px-2.5 py-2 text-[13px] italic text-muted-foreground">
                        {f.v.flagged_terms.map((t) => `"${t}"`).join(", ")}
                      </p>
                    )}
                    <p className="text-[13px] leading-relaxed text-foreground/80">
                      <strong className="font-semibold">What to do:</strong> {f.v.remediation_guidance || f.v.explanation}
                    </p>
                    {editable && (
                      <Button type="button" variant="outline" size="sm" className="self-start rounded-lg text-[13px] font-semibold text-blue-700" onClick={edit ? onEditCaption : onReplaceMedia}>
                        {edit ? "Fix in caption" : "Replace the media"}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
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
                  <strong className="font-semibold">{cleared.length} cleared by context.</strong> The wording matched a rule, but the sentence around it shows the
                  rule doesn't apply. No points were taken off.
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

        {(check.source_checks?.length ?? 0) > 0 && (
          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-lg font-bold text-foreground">Sources checked</h2>
            <SourceChecks checks={check.source_checks} submissionId={sub?.id} />
          </section>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-4 sm:gap-5 xl:sticky xl:top-4">
        <section className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Your post, marked up</h2>
            {mainFile && <span className="text-[11px] text-muted-foreground">{isVideo ? "Video" : "Image 1 of 1"}</span>}
          </div>

          {mainFile && isVideo && (
            <>
              <video
                ref={videoRef}
                src={authedFileUrl(mainFile.url)}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="max-h-[420px] w-full rounded-xl bg-black"
              />
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
            </>
          )}
          {mainFile && !isVideo && (
            <>
              <img src={authedFileUrl(mainFile.url)} alt="" className="max-h-[420px] w-full rounded-xl border border-border/60 object-contain" />
              {imageTerms.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Flagged text in the image</span>
                  {imageTerms.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => pick(f)}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-[13px] ${
                        f.key === picked
                          ? "border-red-500 bg-red-50 font-semibold text-red-900 dark:bg-red-500/10 dark:text-red-100"
                          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                      }`}
                    >
                      {f.v.flagged_terms.length ? f.v.flagged_terms.map((t) => `"${t}"`).join(", ") : f.v.title}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</span>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {captionParts.map((p, i) =>
                p.tone ? (
                  <mark
                    key={i}
                    className={`rounded px-0.5 text-foreground ${p.tone === "chosen" ? "bg-red-200 ring-2 ring-red-500 dark:bg-red-500/40" : "bg-amber-200/70 dark:bg-amber-500/30"}`}
                  >
                    {p.text}
                  </mark>
                ) : (
                  <span key={i}>{p.text}</span>
                )
              )}
            </p>
          </div>
          {selected && (
            <p className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-[13px] text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Rule {selected.v.rule_number}: found in {selected.where === "Caption" ? "the caption" : selected.where === "Video" ? "the video" : selected.where.toLowerCase()}.
              </span>
            </p>
          )}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-lg text-[13px] font-semibold" onClick={onEditCaption}>
                Edit caption
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-lg text-[13px] font-semibold" onClick={onReplaceMedia}>
                {isVideo ? "Replace video" : "Replace image"}
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs sm:p-5">
          <h2 className="text-base font-bold text-foreground">How the score works</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>Every post starts at 100.</li>
            <li>A broken rule takes off 10 to 35 points. A claim that needs a source takes off 5.</li>
            <li>Approval needs {MIN_SCORE} or more and no critical issue.</li>
            <li>Fix an issue and check again: the score updates.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
