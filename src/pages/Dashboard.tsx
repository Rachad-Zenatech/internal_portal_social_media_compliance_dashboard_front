import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDays, format, subDays, subHours, subMinutes } from "date-fns";
import { ChevronRight, ExternalLink, FlaskConical, History, MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DemoPoster from "@/components/video/DemoPoster";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import type { PosterVariant } from "@/context/VideoUploadQueueContext";
import { useAuth } from "@/lib/AuthContext";

// ---------------------------------------------------------------------------
// Sample data. A placeholder until the dashboard reads live metrics from the API.
// Times are relative to now, so the page always looks current.
// ---------------------------------------------------------------------------

type Tone = "red" | "blue" | "green" | "violet";

const TILES: { value: number; label: string; hint: string; tone: Tone; to: string }[] = [
  { value: 7, label: "Needs My Review", hint: "Assigned to you", tone: "red", to: "/compliance/scanner" },
  { value: 5, label: "In Review", hint: "Waiting for approval", tone: "blue", to: "/submissions" },
  { value: 12, label: "Approved", hint: "Ready to schedule or post", tone: "green", to: "/submissions" },
  { value: 6, label: "Upcoming Posts", hint: "Next 7 days", tone: "violet", to: "/content-calendar" },
];

const TILE_TONES: Record<Tone, { card: string; value: string }> = {
  red: { card: "bg-red-50/80 border-red-100 dark:bg-red-500/10 dark:border-red-500/20", value: "text-red-600 dark:text-red-400" },
  blue: { card: "bg-blue-50/80 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20", value: "text-blue-600 dark:text-blue-300" },
  green: { card: "bg-emerald-50/80 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20", value: "text-emerald-700 dark:text-emerald-300" },
  violet: { card: "bg-violet-50/80 border-violet-100 dark:bg-violet-500/10 dark:border-violet-500/20", value: "text-violet-700 dark:text-violet-300" },
};

interface ReviewItem {
  id: string;
  title: string;
  poster: PosterVariant;
  duration: string;
  platform: SocialPlatform;
  brand: string;
  submittedHoursAgo: number;
  /** Hours from now until the review is due. */
  dueInHours: number;
  score: number;
}

const NEEDS_REVIEW: ReviewItem[] = [
  { id: "r1", title: "Behind the Scenes: Field Trials", poster: "dusk", duration: "0:37", platform: "TIKTOK", brand: "ZenaDrone", submittedHoursAgo: 20, dueInHours: 3, score: 100 },
  { id: "r2", title: "CEO on the Future of Defense Tech", poster: "night", duration: "1:12", platform: "LINKEDIN", brand: "ZenaTech", submittedHoursAgo: 46, dueInHours: 4, score: 85 },
  { id: "r3", title: "Q4 Product Showcase", poster: "desert", duration: "0:45", platform: "YOUTUBE", brand: "ZenaDrone", submittedHoursAgo: 49, dueInHours: 26, score: 92 },
  { id: "r4", title: "New Drone Capabilities", poster: "night", duration: "0:28", platform: "TIKTOK", brand: "ZenaDrone", submittedHoursAgo: 70, dueInHours: 50, score: 78 },
  { id: "r5", title: "Supply Chain & Autonomy", poster: "dusk", duration: "1:05", platform: "LINKEDIN", brand: "ZenaTech", submittedHoursAgo: 72, dueInHours: 52, score: 88 },
];

type PostStatus = "Scheduled" | "Approved" | "In Review" | "Draft";

const UPCOMING: { id: string; title: string; poster: PosterVariant; platform: SocialPlatform; brand: string; inDays: number; time: string; status: PostStatus }[] = [
  { id: "u1", title: "Industry Trends Update", poster: "dusk", platform: "LINKEDIN", brand: "ZenaTech", inDays: 0, time: "2:00 PM", status: "Scheduled" },
  { id: "u2", title: "ZenaDrone Product Video", poster: "desert", platform: "TIKTOK", brand: "ZenaDrone", inDays: 1, time: "10:00 AM", status: "Approved" },
  { id: "u3", title: "Sustainability in Defense", poster: "night", platform: "LINKEDIN", brand: "ZenaTech", inDays: 3, time: "11:00 AM", status: "In Review" },
  { id: "u4", title: "Team Spotlight", poster: "dusk", platform: "INSTAGRAM", brand: "ZenaTech", inDays: 4, time: "3:00 PM", status: "Draft" },
];

const POST_STATUS: Record<PostStatus, string> = {
  Scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "In Review": "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

const ACTIVITY: { initials: string; avatar: string; who: string; action: string; item: string; minutesAgo: number }[] = [
  { initials: "KL", avatar: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", who: "Karen Li", action: "requested changes", item: "Behind the Scenes: Field Trials", minutesAgo: 10 },
  { initials: "DW", avatar: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", who: "Daniel Wright", action: "added a comment", item: "CEO on the Future of Defense Tech", minutesAgo: 60 },
  { initials: "SB", avatar: "bg-blue-700 text-white dark:bg-blue-600", who: "Sarah Bennett", action: "approved the submission", item: "Q4 Product Showcase", minutesAgo: 180 },
  { initials: "AM", avatar: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300", who: "You", action: "submitted a new version", item: "New Drone Capabilities", minutesAgo: 300 },
  { initials: "KL", avatar: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300", who: "Karen Li", action: "flagged a compliance issue", item: "Supply Chain & Autonomy", minutesAgo: 1440 },
];

const INSIGHTS = [
  { value: "28", label: "Reviews completed" },
  { value: "6", label: "Required changes" },
  { value: "2", label: "Escalated reviews" },
  { value: "96%", label: "Average compliance score", good: true },
];

const FINDINGS = [
  { label: "Unsupported product claims", count: 5 },
  { label: "Missing disclaimers", count: 3 },
  { label: "Government/defense terminology", count: 3 },
  { label: "Brand guideline deviations", count: 2 },
  { label: "Sensitive imagery or locations", count: 2 },
];

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const scoreTone = (score: number) =>
  score >= 90
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";

function timeAgo(minutes: number) {
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hour${minutes < 120 ? "" : "s"} ago`;
  const days = Math.round(minutes / 1440);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function Thumb({ poster, duration, className = "" }: { poster: PosterVariant; duration?: string; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${className}`}>
      <DemoPoster variant={poster} className="h-full w-full" />
      {duration && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white tabular-nums">{duration}</span>
      )}
    </div>
  );
}

function Section({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`py-0 gap-0 border-border/70 shadow-xs min-w-0 ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const viewAll = (to: string) => (
  <Link to={to} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
    View all
  </Link>
);

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" aria-label="More actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link to="/submissions">
            <ExternalLink className="w-3.5 h-3.5" /> Open in Content Portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link to="/submissions">
            <History className="w-3.5 h-3.5" /> Version history
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = selected.size === NEEDS_REVIEW.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deadline = (dueInHours: number) => {
    const due = new Date(now.getTime() + dueInHours * 3600_000);
    const today = format(due, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    return today ? (
      <span className="font-semibold text-red-600 dark:text-red-400">
        Today
        <br />
        {format(due, "h:mm a")}
      </span>
    ) : (
      <span className="text-foreground">{format(due, "MMM d")}</span>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.full_name ? `Welcome back, ${user.full_name.split(" ")[0]}. ` : ""}Review content, run compliance checks, and manage approvals.
          </p>
        </div>
        <Button asChild className="h-11 rounded-lg px-5 gap-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <Link to="/submissions/new">
            <Plus className="w-4 h-4" /> New Submission
          </Link>
        </Button>
      </header>

      <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-100">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>Placeholder:</strong> everything on this page is sample data until it's connected to live submissions, reviews and the calendar.
        </span>
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className={`group flex items-center gap-3 rounded-xl border px-5 py-4 transition-shadow hover:shadow-sm ${TILE_TONES[t.tone].card}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-3xl font-bold leading-tight ${TILE_TONES[t.tone].value}`}>{t.value}</p>
              <p className={`text-sm font-semibold ${TILE_TONES[t.tone].value}`}>{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_440px] gap-4 items-start">
        {/* Needs your review */}
        <Section title="Needs Your Review" subtitle="Priority order based on deadlines and risk level" action={viewAll("/compliance/scanner")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-y border-border/70 text-left text-xs text-muted-foreground">
                  <th className="w-10 py-2.5 pl-5">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="h-4 w-4 accent-blue-600"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(NEEDS_REVIEW.map((r) => r.id)))}
                    />
                  </th>
                  <th className="py-2.5 font-medium">Content</th>
                  <th className="py-2.5 font-medium">Platform</th>
                  <th className="py-2.5 font-medium">Brand</th>
                  <th className="py-2.5 font-medium">Submitted</th>
                  <th className="py-2.5 font-medium">Deadline</th>
                  <th className="py-2.5 font-medium">Compliance</th>
                  <th className="py-2.5 pr-5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {NEEDS_REVIEW.map((r) => {
                  const submitted = subHours(now, r.submittedHoursAgo);
                  return (
                    <tr key={r.id} className={selected.has(r.id) ? "bg-blue-50/60 dark:bg-blue-500/5" : ""}>
                      <td className="py-3 pl-5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.title}`}
                          className="h-4 w-4 accent-blue-600"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <Thumb poster={r.poster} duration={r.duration} className="h-12 w-[72px]" />
                          <span className="max-w-[150px] font-medium leading-snug text-foreground">{r.title}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <PlatformIcon platform={r.platform} className="w-4 h-4" /> {PLATFORM_LABELS[r.platform] ?? r.platform}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-foreground">{r.brand}</td>
                      <td className="py-3 pr-3 text-xs text-muted-foreground">
                        {format(submitted, "MMM d")}
                        <br />
                        {format(submitted, "h:mm a")}
                      </td>
                      <td className="py-3 pr-3 text-xs">{deadline(r.dueInHours)}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${scoreTone(r.score)}`}>{r.score}/100</span>
                      </td>
                      <td className="py-3 pr-5">
                        <div className="flex items-center gap-1">
                          <Button asChild size="sm" className="h-8 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">
                            <Link to="/compliance/scanner">Review</Link>
                          </Button>
                          <RowMenu />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Upcoming content */}
        <Section title="Upcoming Content" subtitle={`Next 7 days • ${UPCOMING.length} posts`} action={viewAll("/content-calendar")}>
          <ul className="divide-y divide-border/60 border-t border-border/70">
            {UPCOMING.map((u) => {
              const day = addDays(now, u.inDays);
              return (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 shrink-0 text-center">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">{format(day, "MMM")}</p>
                    <p className="text-lg font-bold leading-none text-foreground">{format(day, "d")}</p>
                  </div>
                  <Thumb poster={u.poster} className="h-14 w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{u.title}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <PlatformIcon platform={u.platform} className="w-3 h-3 shrink-0" /> {PLATFORM_LABELS[u.platform] ?? u.platform} • {u.brand}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.inDays === 0 ? "Today" : u.inDays === 1 ? "Tomorrow" : format(day, "MMM d")}, {u.time}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${POST_STATUS[u.status]}`}>{u.status}</span>
                  <RowMenu />
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Recent activity */}
        <Section title="Recent Activity" subtitle="Latest updates across your content" action={viewAll("/log/audit")}>
          <ul className="divide-y divide-border/60 border-t border-border/70">
            {ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${a.avatar}`}>{a.initials}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-semibold">{a.who}</span> {a.action}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.item}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground" title={format(subMinutes(now, a.minutesAgo), "MMM d, h:mm a")}>
                  {timeAgo(a.minutesAgo)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Compliance insights */}
        <Section title="Compliance Insights" action={<span className="text-xs text-muted-foreground">Last 30 days</span>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-border/70">
            {INSIGHTS.map((s, i) => (
              <div key={s.label} className={`px-5 py-4 ${i > 0 ? "sm:border-l border-border/70" : ""}`}>
                <p className={`text-2xl font-bold ${s.good ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Common Findings</p>
            <ul className="divide-y divide-border/60">
              {FINDINGS.map((f) => (
                <li key={f.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{f.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{f.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Since {format(subDays(now, 30), "MMM d")}</p>
          </div>
        </Section>
      </div>
    </div>
  );
}
