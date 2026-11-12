import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertCircle, Check, ImageIcon, Info, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContextUse, SentimentResult } from "@/types/sentiment";

const CARD = "rounded-2xl border border-border/70 bg-card p-5 shadow-xs";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

type Report = NonNullable<SentimentResult["context_report"]>;

const GOOD = "text-emerald-700 dark:text-emerald-400";
const WARN = "text-amber-700 dark:text-amber-300";
const BAD = "text-red-700 dark:text-red-400";
const MUTED = "text-muted-foreground";

const VOICE: Record<string, [string, string]> = {
  ON_VOICE: ["On voice", GOOD], MOSTLY_ON_VOICE: ["Mostly on voice", WARN], OFF_VOICE: ["Off voice", BAD], NO_GUIDE: ["No voice guide", MUTED],
};
const FACTS: Record<string, [string, string]> = {
  CHECKS_OUT: ["Checks out", GOOD], NEEDS_FIX: ["Needs a fix", BAD], UNVERIFIED: ["Not on file", WARN],
  NO_CLAIMS: ["No claims to check", MUTED],
};
const NORMS: Record<string, [string, string]> = {
  FITS: ["Fits", GOOD], MOSTLY_FITS: ["Mostly fits", WARN], NEEDS_WORK: ["Needs work", BAD], NO_NORMS: ["No norms", MUTED],
};
const AUDIENCES: Record<string, [string, string]> = {
  RESONATES: ["Resonates", GOOD], MIXED: ["Mixed", WARN], CAUTIOUS: ["Cautious", WARN], NO_PROFILES: ["No profiles", MUTED],
};

const PILL: Record<string, string> = {
  MATCHES: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CONFLICTS: "bg-red-500/10 text-red-700 dark:text-red-300",
  NO_FACT: "bg-muted text-muted-foreground",
  FITS: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ADJUST: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  RESONATES: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  NEUTRAL: "bg-muted text-muted-foreground",
  CAUTIOUS: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  NEGATIVE: "bg-red-500/10 text-red-700 dark:text-red-300",
};
const PILL_LABEL: Record<string, string> = {
  MATCHES: "Matches", CONFLICTS: "Conflicts", NO_FACT: "No fact", FITS: "Fits", ADJUST: "Adjust",
  RESONATES: "Resonates", NEUTRAL: "Neutral", CAUTIOUS: "Cautious", NEGATIVE: "Negative",
};

const KIND_LABEL: Record<string, string> = {
  BRAND_VOICE: "Brand voice", FACT: "Fact", PLATFORM_NORM: "Platform norm", AUDIENCE_PROFILE: "Audience profile",
};

/** How a source reads in the table: a link from the newsroom reads "Newsroom article", not its whole address. */
function sourceLabel(e: ContextUse): { text: string; href?: string } {
  const isUrl = (v?: string | null) => Boolean(v && /^https?:\/\//i.test(v));
  const href = e.source_url ?? (isUrl(e.source) ? e.source! : undefined);
  if (!href) return { text: e.source ?? "—" };
  if (e.source && !isUrl(e.source)) return { text: e.source, href };
  let host: string;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  return { text: host.includes("zenatech") ? "Newsroom article" : host || "Source", href };
}

/** Rows shown before "Show all". */
const ROWS = 8;

const pretty = (code: string) => code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Pill({ value }: { value: string }) {
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILL[value] ?? "bg-muted"}`}>
      {PILL_LABEL[value] ?? value}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">{children}</span>;
}

function Tile({ eyebrow, verdict, text }: { eyebrow: string; verdict: [string, string]; text: string }) {
  return (
    <div className={`${CARD} flex flex-col gap-1`}>
      <p className={EYEBROW}>{eyebrow}</p>
      <p className={`text-xl font-bold ${verdict[1]}`}>{verdict[0]}</p>
      <p className="text-[13px] leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}

function CardHead({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className={EYEBROW}>{eyebrow}</p>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      {right && <div className="flex flex-wrap gap-1.5">{right}</div>}
    </div>
  );
}

/**
 * How the post measures against the Messaging Context its brand, audiences and platforms bring in: four summary
 * tiles, then brand voice, facts, platform norms and audiences in turn (each judgement naming the entry it came from),
 * graphic vs captions, and what the analysis was given.
 */
export default function ContextReportView({
  report,
  visual,
  entries,
  post,
}: {
  report: Report;
  visual?: SentimentResult["visual_alignment"];
  entries: ContextUse[];
  /** The post itself (picture and captions), shown at the top for reference. */
  post?: ReactNode;
}) {
  const [allRows, setAllRows] = useState(false);
  const rows = allRows ? entries : entries.slice(0, ROWS);
  const used = entries.filter((e) => e.status !== "NOT_APPLIED");
  const notApplied = entries.filter((e) => e.status === "NOT_APPLIED");
  const old = entries.filter((e) => e.status === "USED_OLD");
  const v = report.brand_voice;
  const f = report.facts;
  const n = report.platform_norms;
  const a = report.audiences;
  const platformsInNorms = Array.from(new Set(n.checks.map((c) => c.title).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className={EYEBROW}>Sentiment analysis</p>
          <h2 className="text-2xl font-bold text-foreground">Messaging context fit</h2>
          <p className="text-[13px] text-muted-foreground">
            How this post measures against the brand voice, facts, platform norms and audience notes your team keeps in
            Messaging context. Every judgement below says which entry it came from.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-1.5 text-[11px]">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 font-semibold text-blue-700 dark:text-blue-300">{used.length} entries used</span>
            {notApplied.length > 0 && <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{notApplied.length} not applicable</span>}
            {old.length > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-800 dark:text-amber-200">
                {old.length} may be out of date
              </span>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to="/compliance/context">Open Messaging context</Link>
          </Button>
        </div>
      </div>

      {post}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile eyebrow="Brand voice" verdict={VOICE[v.verdict] ?? [v.verdict, ""]} text={v.summary} />
        <Tile eyebrow="Facts" verdict={FACTS[f.verdict] ?? [f.verdict, ""]} text={f.summary} />
        <Tile eyebrow="Platform norms" verdict={NORMS[n.verdict] ?? [n.verdict, ""]} text={n.summary} />
        <Tile eyebrow="Audiences" verdict={AUDIENCES[a.verdict] ?? [a.verdict, ""]} text={a.summary} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Brand voice */}
        <section className={`${CARD} flex flex-col gap-3`}>
          <CardHead eyebrow="Brand voice" title={v.headline} />
          {v.follows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Follows your voice</p>
              {v.follows.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="text-[13px]">
                    <p className="font-medium text-foreground">&ldquo;{l.quote}&rdquo;</p>
                    <p className="text-muted-foreground">
                      {l.why} {l.title && <Chip>{l.title}</Chip>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {v.drifts.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Drifts from your voice</p>
              {v.drifts.map((l, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-[13px]">
                      <p className="font-medium text-foreground">&ldquo;{l.quote}&rdquo;</p>
                      <p className="text-muted-foreground">
                        {l.why} {l.rule && <Chip>{l.rule}</Chip>}
                      </p>
                    </div>
                  </div>
                  {l.rewrite && (
                    <p className="ml-6 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-900 dark:text-emerald-200">
                      <span className="font-semibold">In your voice: </span>&ldquo;{l.rewrite}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {v.follows.length === 0 && v.drifts.length === 0 && <p className="text-[13px] text-muted-foreground">{v.summary}</p>}
        </section>

        {/* Facts */}
        <section className={`${CARD} flex flex-col gap-3`}>
          <CardHead eyebrow="Facts" title="Claims against what is on file" />
          {f.claims.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No factual claims to check.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-1.5 pr-3 font-semibold">Claim in the post</th>
                    <th className="pb-1.5 pr-3 font-semibold">Result</th>
                    <th className="pb-1.5 font-semibold">Fact on file</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {f.claims.map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-2 pr-3 text-foreground">&ldquo;{c.claim}&rdquo;</td>
                      <td className="py-2 pr-3"><Pill value={c.result} /></td>
                      <td className="py-2">
                        <span className="font-medium text-foreground">{c.title ?? "—"}</span>
                        {c.note && <span className="block text-[12px] text-muted-foreground">{c.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {f.fix && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-900 dark:text-red-200">
              <span className="font-semibold">Fix before sending: </span>
              {f.fix}
            </p>
          )}
        </section>

        {/* Platform norms */}
        <section className={`${CARD} flex flex-col gap-3`}>
          <CardHead eyebrow="Platform norms" title="Fits where it will be posted" right={platformsInNorms.map((p) => <Chip key={p}>{p}</Chip>)} />
          {n.checks.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No platform norms for these platforms yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {n.checks.map((c, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex gap-2">
                    {c.status === "FITS" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="text-[13px]">
                      <p className="font-semibold text-foreground">
                        {c.aspect}
                        {platformsInNorms.length > 1 && c.title && <span className="ml-1.5 font-normal text-muted-foreground">· {c.title}</span>}
                      </p>
                      <p className="text-muted-foreground">Norm: {c.norm}. {c.observation}</p>
                    </div>
                  </div>
                  <Pill value={c.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Audiences */}
        <section className={`${CARD} flex flex-col gap-3`}>
          <CardHead
            eyebrow="Audience profiles"
            title="How each audience is likely to read it"
            right={<Chip>{a.readings.length} profile{a.readings.length === 1 ? "" : "s"} applied</Chip>}
          />
          {a.readings.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No audience profiles for these audiences yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {a.readings.map((r, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div className="text-[13px]">
                    <p className="font-semibold text-foreground">{r.title ?? r.audience}</p>
                    <p className="text-muted-foreground">{r.reading}</p>
                  </div>
                  <Pill value={r.reaction} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {visual && (
        <section className={`${CARD} flex flex-col gap-2`}>
          <CardHead
            eyebrow="Graphic"
            title="Graphic vs captions"
            right={
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  visual.verdict === "ALIGNED" ? PILL.FITS : visual.verdict === "PARTIAL" ? PILL.ADJUST : PILL.CONFLICTS
                }`}
              >
                {visual.verdict === "ALIGNED" ? "Matches the captions" : visual.verdict === "PARTIAL" ? "Partly matches" : "Doesn't match"}
              </span>
            }
          />
          <p className="flex gap-2 text-[13px] text-foreground/80">
            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> {visual.explanation}
          </p>
          {visual.mismatches.length > 0 && (
            <ul className="ml-6 flex flex-col gap-1">
              {visual.mismatches.map((m, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-foreground">
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" /> {m}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Transparency */}
      <section className={`${CARD} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className={EYEBROW}>Transparency</p>
            <h3 className="text-base font-bold text-foreground">Context the analysis was given</h3>
            <p className="text-[13px] text-muted-foreground">
              Only entries that apply to this post's brand, audience and platform are used. Nothing else is guessed.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <Link to="/compliance/context">Add missing context</Link>
          </Button>
        </div>
        {entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-1.5 pr-3 font-semibold">Entry</th>
                  <th className="pb-1.5 pr-3 font-semibold">Kind</th>
                  <th className="pb-1.5 pr-3 font-semibold">Applies to</th>
                  <th className="pb-1.5 pr-3 font-semibold">As of</th>
                  <th className="pb-1.5 pr-3 font-semibold">Source</th>
                  <th className="pb-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((e) => {
                  const src = sourceLabel(e);
                  return (
                  <tr key={e.id}>
                    <td className="max-w-[240px] py-2 pr-3 font-semibold text-foreground">
                      <span className="line-clamp-2">{e.title}</span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{KIND_LABEL[e.kind] ?? e.kind}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{e.applies_to.length ? e.applies_to.map(pretty).join(", ") : "Everything"}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{e.as_of ? format(new Date(e.as_of), "MMM yyyy") : "—"}</td>
                    <td className="max-w-[200px] py-2 pr-3 text-muted-foreground">
                      {src.href ? (
                        <a href={src.href} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-300">
                          {src.text}
                        </a>
                      ) : (
                        <span className="line-clamp-2">{src.text}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          e.status === "USED" ? PILL.FITS : e.status === "USED_OLD" ? PILL.ADJUST : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {e.status === "USED" ? "Used" : e.status === "USED_OLD" ? `Used, ${e.note?.toLowerCase() ?? "may be out of date"}` : `Not applied: ${e.note?.toLowerCase() ?? ""}`}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {entries.length > ROWS && (
              <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => setAllRows((v) => !v)}>
                {allRows ? "Show fewer" : `Show all ${entries.length}`}
              </Button>
            )}
          </div>
        )}
        {report.gaps.length > 0 && (
          <p className="flex gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-[13px] text-blue-950 dark:text-blue-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>
              <span className="font-semibold">Gaps spotted. </span>
              {report.gaps.join(" ")} Add them and the next analysis can judge them.
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
