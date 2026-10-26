import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Eye,
  FlaskConical,
  Heart,
  Info,
  ListOrdered,
  Loader2,
  Percent,
  Smile,
  Trophy,
  XCircle,
} from "lucide-react";

import { Section, SectionIcon, TONE, type Tone } from "@/components/dashboard/dashboardParts";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePerformance } from "@/hooks/usePerformance";
import { submissionService } from "@/services/submissionService";
import type { PerformancePost, PlatformApi, PostHealth, PostMetric } from "@/types/performance";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];
const ALL = "ALL";

const HEALTH: Record<PostHealth, { label: string; tone: string; edge: string; Icon: typeof CheckCircle2 }> = {
  HEALTHY: { label: "Positive", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", edge: "border-l-emerald-500", Icon: CheckCircle2 },
  WATCH: { label: "Watch", tone: "bg-amber-500/10 text-amber-800 dark:text-amber-200", edge: "border-l-amber-500", Icon: AlertTriangle },
  AT_RISK: { label: "At risk", tone: "bg-red-500/10 text-red-700 dark:text-red-300", edge: "border-l-red-500", Icon: XCircle },
};

// Gold, silver and bronze for the top three posts.
const MEDALS = [
  "bg-amber-100 text-amber-700 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/40",
  "bg-slate-100 text-slate-600 ring-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/40",
  "bg-orange-100 text-orange-700 ring-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/40",
];

const num = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const platformLabel = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

const METRIC_NAMES: Record<PostMetric, string> = {
  views: "Views",
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  clicks: "Clicks",
  quotes: "Quotes",
  dislikes: "Dislikes",
  negative_reactions: "Negative reactions",
  avg_watch_seconds: "Avg. watch time",
};
/** The platform's own name for a metric (e.g. LinkedIn and X report impressions, not views). */
const metricName = (labels: Partial<Record<PostMetric, string>>, m: PostMetric) => labels[m] ?? METRIC_NAMES[m];
/** A number the platform reports, or a dash when its API doesn't provide it (never a misleading 0). */
const count = (p: PerformancePost, m: PostMetric) => {
  const v = p[m];
  if (v == null || !p.available.includes(m)) return "—";
  return m === "avg_watch_seconds" ? `${v}s` : num.format(v);
};

function HealthBadge({ health }: { health: PostHealth }) {
  const h = HEALTH[health];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${h.tone}`}>
      <h.Icon className="w-3 h-3" /> {h.label}
    </span>
  );
}

/** A headline number with a coloured icon, like the dashboards' count cards. */
function Tile({ label, value, sub, Icon, tone, attention = false }: { label: string; value: string; sub?: string; Icon: typeof Eye; tone: Tone; attention?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border bg-card px-4 py-3.5 ${attention ? "border-amber-200 dark:border-amber-500/30" : "border-border/70"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0">
        <span className={`block text-2xl font-semibold leading-tight tabular-nums ${attention ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{value}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        {sub && <span className="block text-[11px] leading-snug text-muted-foreground/80">{sub}</span>}
      </span>
    </div>
  );
}

/** Views per platform: one series, so bars share one colour and each is labelled with its platform and number. */
function ViewsByPlatform({ posts }: { posts: PerformancePost[] }) {
  const rows = useMemo(() => {
    const by = new Map<string, { platform: string; name: string; views: number; posts: number }>();
    for (const p of posts) {
      const r = by.get(p.platform) ?? { platform: p.platform, name: p.platform_name, views: 0, posts: 0 };
      r.views += p.available.includes("views") ? p.views ?? 0 : 0;
      r.posts += 1;
      by.set(p.platform, r);
    }
    return [...by.values()].sort((a, b) => b.views - a.views);
  }, [posts]);
  if (rows.length === 0) return <p className="border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">No posts in this period.</p>;
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <ul className="space-y-3 border-t border-border/60 px-4 py-4">
      {rows.map((r) => (
        <li key={r.platform} title={`${r.name}: ${num.format(r.views)} views across ${r.posts} post${r.posts === 1 ? "" : "s"}`}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
              <PlatformIcon platform={r.platform as SocialPlatform} className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{r.name}</span>
              <span className="font-normal text-muted-foreground">
                · {r.posts} post{r.posts === 1 ? "" : "s"}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{compact.format(r.views)}</span>
          </div>
          <div className="mt-1.5 h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-blue-500 transition-[width] duration-500 dark:bg-blue-400" style={{ width: `${Math.max(1.5, (r.views / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A filter shown as a row of pills, like the Content Calendar's platform filter. */
function Pills<T extends string | number | boolean>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-3 py-1.5 transition-colors ${value === o.v ? "bg-blue-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Share of positive, neutral and negative comments, labelled so it never relies on colour alone. */
function SentimentBar({ s, showLabels = false }: { s?: PerformancePost["sentiment"]; showLabels?: boolean }) {
  if (!s) return <span className="text-[11px] text-muted-foreground">No comments yet</span>;
  return (
    <div className="min-w-24">
      <div
        className="flex h-2 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={`${s.positive}% positive, ${s.neutral}% neutral, ${s.negative}% negative comments`}
      >
        <span className="bg-emerald-500 rounded-l-full" style={{ width: `${s.positive}%` }} />
        <span className="bg-slate-300 dark:bg-slate-600" style={{ width: `${s.neutral}%` }} />
        <span className="bg-red-500 rounded-r-full" style={{ width: `${s.negative}%` }} />
      </div>
      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
        {showLabels ? `${s.positive}% positive · ${s.neutral}% neutral · ${s.negative}% negative` : `${s.positive}% + · ${s.negative}% −`}
      </p>
    </div>
  );
}

/** The sign of how it's being received, from whatever this platform provides. */
function ReceptionCell({ p }: { p: PerformancePost }) {
  if (p.sentiment) return <SentimentBar s={p.sentiment} />;
  if (p.dislikes != null && p.likes != null && p.likes + p.dislikes > 0) {
    return <span className="text-[11px] tabular-nums text-muted-foreground">{((p.dislikes / (p.likes + p.dislikes)) * 100).toFixed(0)}% {metricName(p.labels, "dislikes").toLowerCase()}</span>;
  }
  if (p.negative_reactions != null && p.likes) {
    return <span className="text-[11px] tabular-nums text-muted-foreground">{((p.negative_reactions / p.likes) * 100).toFixed(0)}% angry / sad</span>;
  }
  return (
    <span className="text-[11px] text-muted-foreground" title={p.comment_text ? undefined : `${p.platform_name}'s API doesn't return comment text`}>
      {p.comment_text ? "Too few comments yet" : "No comment text from API"}
    </span>
  );
}

/** What each platform's API gives us for a post: the numbers, whether comments can be read, and the access it takes. */
function PlatformApisCard({ apis }: { apis: PlatformApi[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="py-0 gap-0 rounded-xl border-border/70 shadow-none">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
          <SectionIcon Icon={Info} tone="slate" /> What each platform gives us
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Numbers differ by platform; a dash means its API doesn't provide it
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border/60">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-muted/40 text-[11px] text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Platform</th>
                <th className="px-2 py-2 text-left font-semibold">Numbers per post</th>
                <th className="px-2 py-2 text-left font-semibold">Reaction checked by</th>
                <th className="px-4 py-2 text-left font-semibold">Access needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 align-top">
              {apis.map((a) => (
                <tr key={a.key}>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{a.api ?? "No API"}</p>
                  </td>
                  <td className="px-2 py-2.5 text-foreground/90">{a.metrics.length ? a.metrics.map((m) => metricName(a.labels, m)).join(", ") : "None"}</td>
                  <td className="px-2 py-2.5 text-foreground/90">
                    {a.negative_signal ?? "Nothing: like rate only"}
                    {!a.comment_text && a.metrics.length > 0 && <span className="block text-[11px] text-muted-foreground">Comment text isn't available</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-muted-foreground max-w-[340px]">{a.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Views per day since the post went live: one series, so the title names it and there's no legend. */
function DailyViews({ values, publishedAt, label = "Views" }: { values: number[]; publishedAt: string; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const W = 100 / values.length;
  const start = new Date(publishedAt);
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{label} per day since it went live</p>
      <div className="relative mt-2 h-28">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Views per day">
          {values.map((v, i) => {
            const h = Math.max(1.5, (v / max) * 96);
            return (
              <rect
                key={i}
                x={i * W + 0.4}
                y={100 - h}
                width={Math.max(0.6, W - 0.8)}
                height={h}
                rx={0.8}
                className={hover === i ? "fill-blue-700 dark:fill-blue-300" : "fill-blue-500 dark:fill-blue-400"}
              />
            );
          })}
          {/* Hit targets wider than the bars. */}
          {values.map((_, i) => (
            <rect key={`hit-${i}`} x={i * W} y={0} width={W} height={100} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
        {hover != null && (
          <div
            // Inside the chart, and kept from running off either edge.
            className={`pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-popover px-2 py-1 text-[11px] shadow-sm whitespace-nowrap ${
              hover < values.length * 0.25 ? "ml-2" : hover > values.length * 0.75 ? "-translate-x-full -ml-2" : "-translate-x-1/2"
            }`}
            style={{ left: `${(hover + 0.5) * W}%` }}
          >
            <span className="text-muted-foreground">{format(new Date(start.getTime() + hover * 86400_000), "EEE MMM d")}</span>{" "}
            <span className="font-semibold tabular-nums text-foreground">{num.format(values[hover])} {label.toLowerCase()}</span>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between border-t border-border pt-1 text-[10px] text-muted-foreground">
        <span>{format(start, "MMM d")}</span>
        <span>{values.length} day{values.length === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}

function PostDetail({ post, onClose }: { post: PerformancePost | null; onClose: () => void }) {
  return (
    <Sheet open={post !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {post && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{post.title}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
                <PlatformIcon platform={post.platform as SocialPlatform} className="w-3.5 h-3.5" /> {post.platform_name} · live{" "}
                {formatDistanceToNow(new Date(post.published_at), { addSuffix: true })}
                {post.reference_code && post.submission_id && (
                  <>
                    {" · "}
                    <Link to={`/submissions/${post.submission_id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                      {post.reference_code}
                    </Link>
                  </>
                )}
                {post.is_sample && <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold">Sample post</span>}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <div className="flex items-start gap-2">
                <HealthBadge health={post.health} />
                <div className="text-xs text-muted-foreground">
                  {post.reasons.length ? (
                    post.reasons.map((r) => <p key={r}>{r}</p>)
                  ) : (
                    <p>
                      {post.sentiment_basis.length
                        ? `No warning signs in its ${post.sentiment_basis.join(" or ")}, and engagement is normal for ${post.platform_name}.`
                        : `Engagement is normal for ${post.platform_name}. There's no comment sentiment to check here.`}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ...post.available.map((m) => [metricName(post.labels, m), count(post, m)]),
                  ...(post.engagement_rate != null ? [["Engagement", pct(post.engagement_rate)]] : []),
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border/70 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums text-foreground">{value}</p>
                  </div>
                ))}
              </div>
              <DailyViews values={post.daily_views} publishedAt={post.published_at} label={metricName(post.labels, "views")} />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">How it's being received</p>
                <p className="text-[11px] text-muted-foreground">
                  {post.sentiment_basis.length
                    ? `Judged from ${post.sentiment_basis.join(" and ")}${post.views ? ", and the like rate" : ""}.`
                    : post.comment_text
                    ? "Not enough comments yet to judge; the like rate is checked."
                    : `${post.platform_name}'s API doesn't return comment text, so only the like rate is checked.`}
                </p>
                {post.sentiment && <SentimentBar s={post.sentiment} showLabels />}
                {post.negative_change != null && post.negative_change !== 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Negative comments {post.negative_change > 0 ? "up" : "down"} {Math.abs(post.negative_change)} points since the last check.
                  </p>
                )}
              </div>
              {post.comment_samples.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Recent comments</p>
                  <ul className="space-y-1.5">
                    {post.comment_samples.map((c, i) => (
                      <li
                        key={i}
                        className={`border-l-2 pl-2 text-xs ${c.sentiment === "NEGATIVE" ? "border-red-500/60" : c.sentiment === "POSITIVE" ? "border-emerald-500/60" : "border-border"}`}
                      >
                        <p className="text-foreground/90">{c.text}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {c.author} · {c.sentiment.toLowerCase()} · {c.likes} likes
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {post.fetched_at && (
                <p className="text-[10px] text-muted-foreground">Numbers from {formatDistanceToNow(new Date(post.fetched_at), { addSuffix: true })}; refreshed every few hours.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * How our live posts are doing: views, likes, comments and shares per platform, and whether the reaction is still
 * positive (comment sentiment, rising negativity, like rates against the platform's norm). Reviewers and managers see
 * the team's posts; creators see their own.
 */
export default function PostPerformancePage() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  // Undefined until someone picks: the server starts reviewers on the team's posts and creators on their own.
  const [mine, setMine] = useState<boolean | undefined>(undefined);
  const [open, setOpen] = useState<PerformancePost | null>(null);
  const { report, isLoading, isFetching, error } = usePerformance({
    days,
    platform: platform === ALL ? undefined : platform,
    brand: brand === ALL ? undefined : brand,
    mine,
  });
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });

  const posts = useMemo(() => report?.posts ?? [], [report]);
  const attention = posts.filter((p) => p.health !== "HEALTHY");
  const top = useMemo(
    () =>
      [...posts]
        .filter((p) => (p.views ?? 0) >= 500 && p.engagement_rate != null)
        .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
        .slice(0, 3),
    [posts]
  );
  const s = report?.summary;
  const showingMine = mine ?? (report ? !report.team_view : false);

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Post Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How our live posts are doing (views, likes, comments, shares) and whether the reaction is still positive.
          </p>
        </div>
        {/* Everyone can switch: the numbers are read-only, and seeing what works across the team helps creators. */}
        <Pills
          label="Whose posts"
          value={showingMine}
          onChange={setMine}
          options={[
            { v: true, label: "My posts" },
            { v: false, label: "Team posts" },
          ]}
        />
      </header>

      {report?.is_mock && (
        <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
          <FlaskConical className="mt-px w-4 h-4 shrink-0" />
          <span>
            Sample numbers: posts aren't published to the platforms from here yet, so there's nothing real to measure. Posts
            marked "Sample post" are examples; our own live posts show made-up numbers until analytics are connected.
          </span>
        </p>
      )}

      {/* Filters, in one row above everything they affect. */}
      <div className="flex flex-wrap items-center gap-2">
        <Pills label="Period" value={days} onChange={setDays} options={RANGES.map((r) => ({ v: r.days, label: r.label }))} />
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger size="sm" className="h-8 w-[170px] rounded-full bg-card text-xs" aria-label="Platform">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">All platforms</SelectItem>
            {(options.data?.platforms ?? []).map((p) => (
              <SelectItem key={p} value={p} className="text-xs">
                {platformLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger size="sm" className="h-8 w-[190px] rounded-full bg-card text-xs" aria-label="Brand">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">All brands</SelectItem>
            {(options.data?.brands ?? []).map((b) => (
              <SelectItem key={b.code} value={b.code} className="text-xs">
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading post numbers...
        </p>
      ) : error ? (
        <p className="text-xs text-red-700 dark:text-red-300">Couldn't load post performance: {error.message}</p>
      ) : !report || !s ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Tile
              label="Views"
              value={compact.format(s.views)}
              sub={`As each platform counts them · ${s.posts} post${s.posts === 1 ? "" : "s"}`}
              Icon={Eye}
              tone="blue"
            />
            <Tile label="Engagements" value={compact.format(s.engagements)} sub="Likes, comments, shares, saves" Icon={Heart} tone="violet" />
            <Tile label="Engagement rate" value={pct(s.engagement_rate)} sub="Engagements per view" Icon={Percent} tone="slate" />
            <Tile
              label="Positive comments"
              value={s.positive_pct != null ? `${s.positive_pct}%` : "–"}
              sub={s.negative_pct != null ? `${s.negative_pct}% negative` : "No comments yet"}
              Icon={Smile}
              tone="emerald"
            />
            <Tile
              label="Need attention"
              value={String(s.at_risk + s.watch)}
              sub={s.at_risk + s.watch ? `${s.at_risk} at risk · ${s.watch} to watch` : "Everything's positive"}
              Icon={AlertTriangle}
              tone={s.at_risk ? "red" : "amber"}
              attention={s.at_risk + s.watch > 0}
            />
          </div>

          {report.message && <p className="text-xs text-muted-foreground">{report.message}</p>}
          {report.unmeasured > 0 && (
            <p className="text-xs text-muted-foreground">
              {report.unmeasured} website post{report.unmeasured === 1 ? " isn't" : "s aren't"} measured here: page views come from the
              website's analytics, which isn't connected.
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3 items-start">
            <Section
              title="Needs Attention"
              count={attention.length}
              subtitle="Posts whose reaction is turning, worst first"
              icon={<SectionIcon Icon={AlertTriangle} tone="amber" />}
            >
              {attention.length === 0 ? (
                <div className="border-t border-border/60 px-4 py-8 text-center">
                  <CheckCircle2 className="mx-auto w-8 h-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-semibold text-foreground">All positive</p>
                  <p className="text-xs text-muted-foreground">Every post's reaction is still positive.</p>
                </div>
              ) : (
                <ul className="space-y-2 border-t border-border/60 bg-muted/20 p-3">
                  {attention.slice(0, 5).map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => setOpen(p)}
                        className={`w-full rounded-lg border-l-4 bg-card px-3 py-2.5 text-left shadow-xs ring-1 ring-border/60 transition-shadow hover:shadow-sm ${HEALTH[p.health].edge}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
                            <PlatformIcon platform={p.platform as SocialPlatform} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{p.title}</span>
                          </p>
                          <HealthBadge health={p.health} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{p.reasons.join(" ")}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Best Performing"
              subtitle="Highest engagement, posts with 500+ views"
              icon={<SectionIcon Icon={Trophy} tone="amber" />}
            >
              {top.length === 0 ? (
                <p className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">Not enough views yet to compare posts.</p>
              ) : (
                <ol className="divide-y divide-border/60 border-t border-border/60">
                  {top.map((p, i) => (
                    <li key={p.key}>
                      <button type="button" onClick={() => setOpen(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ring-1 ${MEDALS[i]}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{p.title}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <PlatformIcon platform={p.platform as SocialPlatform} className="w-3 h-3" />
                            {p.platform_name} · {compact.format(p.views ?? 0)} {metricName(p.labels, "views").toLowerCase()}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{pct(p.engagement_rate ?? 0)}</span>
                          <span className="text-[10px] text-muted-foreground">engagement</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section
              title="Views by Platform"
              subtitle={`Last ${days} days`}
              icon={<SectionIcon Icon={BarChart3} tone="blue" />}
              className="lg:col-span-2 2xl:col-span-1"
            >
              <ViewsByPlatform posts={posts} />
            </Section>
          </div>

          <PlatformApisCard apis={report.platform_apis} />

          <Section
            title="All Posts"
            count={posts.length}
            subtitle="One row per platform · select a post for its comments and daily views"
            icon={<SectionIcon Icon={ListOrdered} tone="slate" />}
          >
            {posts.length === 0 ? (
              <p className="border-t border-border/60 p-6 text-center text-xs text-muted-foreground">{report.message || "No posts in this period."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-xs">
                  <thead className="border-y border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Post</th>
                      <th className="px-2 py-2 text-left font-semibold">Platform</th>
                      <th className="px-2 py-2 text-right font-semibold" title="Impressions on LinkedIn and X; views elsewhere">Views</th>
                      <th className="px-2 py-2 text-right font-semibold" title="Reactions on LinkedIn and Facebook; upvotes on Reddit">Likes</th>
                      <th className="px-2 py-2 text-right font-semibold" title="Replies on X">Comments</th>
                      <th className="px-2 py-2 text-right font-semibold" title="Reposts on LinkedIn and X">Shares</th>
                      <th className="px-2 py-2 text-right font-semibold">Engagement</th>
                      <th className="px-2 py-2 text-left font-semibold">Reception</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {posts.map((p) => (
                      <tr key={p.key} onClick={() => setOpen(p)} className="cursor-pointer transition-colors hover:bg-muted/30">
                        <td className={`border-l-4 px-4 py-2.5 ${p.health === "HEALTHY" ? "border-l-transparent" : HEALTH[p.health].edge}`}>
                          <p className="max-w-[280px] truncate font-semibold text-foreground" title={p.title}>
                            {p.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.is_sample ? "Sample post" : p.reference_code}
                            {p.creator_name && ` · ${p.creator_name}`} · {format(new Date(p.published_at), "MMM d")}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <PlatformIcon platform={p.platform as SocialPlatform} className="w-3.5 h-3.5" /> {p.platform_name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums" title={metricName(p.labels, "views")}>{count(p, "views")}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums" title={metricName(p.labels, "likes")}>{count(p, "likes")}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums" title={metricName(p.labels, "comments")}>{count(p, "comments")}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums" title={metricName(p.labels, "shares")}>{count(p, "shares")}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{p.engagement_rate != null ? pct(p.engagement_rate) : "—"}</td>
                        <td className="px-2 py-2.5">
                          <ReceptionCell p={p} />
                        </td>
                        <td className="px-4 py-2.5">
                          <HealthBadge health={p.health} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      <PostDetail post={open} onClose={() => setOpen(null)} />
    </div>
  );
}
