/** Pieces shared by the reviewer and creator dashboards. */
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  MessageSquareWarning,
  MoreHorizontal,
  RotateCcw,
  Send,
  ShieldCheck,
  Undo2,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CoverThumb } from "@/components/submissions/PostPreview";
import { UnderReviewBadge } from "@/components/submissions/submissionUi";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import type { DashboardSummary, SubmissionSummary } from "@/types/submission";

export const UPCOMING_DAYS = 7;

export function greeting(now: Date) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export const issuesText = (n?: number | null) => (n ? `${n} issue${n === 1 ? "" : "s"} to fix` : null);

/** One number at the top of a dashboard, with a short note under it. */
export function StatCard({
  label,
  value,
  note,
  noteTone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  note?: string | null;
  noteTone?: "muted" | "amber" | "red" | "green";
}) {
  const tone = {
    muted: "text-muted-foreground",
    amber: "text-amber-700 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    green: "text-emerald-700 dark:text-emerald-400",
  }[noteTone];
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border/70 bg-card p-4 sm:p-5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{value}</span>
      {note && <span className={`text-xs font-medium ${tone}`}>{note}</span>}
    </div>
  );
}

/** Who did what to which post, newest first (from GET /api/submissions/dashboard). */
export function ActivityList({
  items,
  loading,
  empty,
}: {
  items: DashboardSummary["activity"];
  loading: boolean;
  empty: string;
}) {
  if (loading) return <Loading />;
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-border/60 border-t border-border/60">
      {items.map((a, i) => {
        const style = ACTIVITY_STYLE[a.action] ?? { Icon: Bell, tone: "bg-muted text-muted-foreground" };
        return (
          <li key={`${a.submission_id}-${a.at}-${i}`}>
            <Link to={`/submissions/${a.submission_id}`} className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.tone}`}>
                <style.Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">
                  <span className="font-semibold">{a.actor_name ?? "Someone"}</span> {a.action}{" "}
                  <span className="font-medium">{a.title}</span>
                </span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Shortcuts that open the upload form with a content type already picked.
export const QUICK_CREATE: { type: string; label: string; Icon: LucideIcon }[] = [
  { type: "VIDEO", label: "Video", Icon: Video },
  { type: "SOCIAL_POST", label: "Social post", Icon: MessageSquareText },
  { type: "CAROUSEL", label: "Carousel", Icon: GalleryHorizontalEnd },
  { type: "IMAGE", label: "Image", Icon: ImageIcon },
  { type: "AD", label: "Paid ad", Icon: Megaphone },
  { type: "BLOG", label: "Blog", Icon: FileText },
];

// The same status colours as the Content Portal.
export const STATUS_PILL: Record<string, { label: string; pill: string }> = {
  SCHEDULED: { label: "Scheduled", pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  APPROVED: { label: "Approved", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  IN_REVIEW: { label: "In Review", pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes Requested", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  REJECTED: { label: "Rejected", pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
];

/** Approved content with a publish time still ahead counts as scheduled. */
export const statusOf = (s: SubmissionSummary) =>
  s.status === "APPROVED" && s.publish_at && !isPast(new Date(s.publish_at)) ? "SCHEDULED" : s.status;

export const initials = (name?: string | null) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const avatarTone = (key: string) => AVATAR_TONES[[...key].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_TONES.length];

/** A compliance score the way the Content Screener shows it. */
export function Score({ score, pending = false }: { score?: number | null; pending?: boolean }) {
  if (pending) return <UnderReviewBadge />;
  if (score == null) return <span className="text-xs text-muted-foreground">Not checked</span>;
  const [tone, Icon] =
    score >= 80
      ? ["text-emerald-600 dark:text-emerald-400", CheckCircle2]
      : score >= 60
      ? ["text-amber-600 dark:text-amber-400", AlertTriangle]
      : ["text-red-600 dark:text-red-400", XCircle];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums whitespace-nowrap ${tone}`}>
      <Icon className="w-3.5 h-3.5" /> {score}/100
    </span>
  );
}

export function Thumb({ s, className = "" }: { s: SubmissionSummary; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-muted ${className}`}>
      <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
    </div>
  );
}

export function Platforms({ platforms }: { platforms: string[] }) {
  if (!platforms.length) return <span className="text-xs text-muted-foreground">Not set</span>;
  const first = platforms[0] as SocialPlatform;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 whitespace-nowrap">
      <PlatformIcon platform={first} className="w-3.5 h-3.5" /> {PLATFORM_LABELS[first] ?? first}
      {platforms.length > 1 && ` +${platforms.length - 1}`}
    </span>
  );
}

/** A titled panel, like the Content Portal's: heading with a muted count, then a bordered card. */
export function Section({
  title,
  count,
  subtitle,
  action,
  icon,
  children,
  className = "",
}: {
  title: string;
  count?: number | string;
  subtitle?: string;
  action?: React.ReactNode;
  /** An optional icon before the title. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {title} {count != null && <span className="font-normal text-muted-foreground">{count}</span>}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">{children}</p>;
}

export function Loading() {
  return (
    <p className="flex items-center justify-center gap-2 border-t border-border/60 px-4 py-8 text-xs text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
    </p>
  );
}

export const viewAll = (to: string, label = "View all") => (
  <Link to={to} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
    {label}
  </Link>
);

export function RowMenu({ id }: { id: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="More actions">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild className="text-xs gap-2">
          <Link to={`/submissions/${id}`}>
            <ExternalLink className="w-3.5 h-3.5" /> Open details and history
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Deadline({ dueAt }: { dueAt?: string | null }) {
  if (!dueAt) return <span className="text-muted-foreground">None</span>;
  const due = new Date(dueAt);
  if (isPast(due)) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        Overdue
        <br />
        {formatDistanceToNow(due)}
      </span>
    );
  }
  return isToday(due) ? (
    <span className="font-semibold text-red-600 dark:text-red-400">
      Today
      <br />
      {format(due, "h:mm a")}
    </span>
  ) : (
    <span className="text-foreground">{format(due, "MMM d")}</span>
  );
}

// ---------------------------------------------------------------------------
// Colour and icon pieces shared by both dashboards
// ---------------------------------------------------------------------------

/** Soft icon backgrounds, one per colour. Stage colours match the status pills. */
export const TONE = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
} as const;
export type Tone = keyof typeof TONE;

/** The small coloured icon before a section title. */
export function SectionIcon({ Icon, tone }: { Icon: LucideIcon; tone: Tone }) {
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONE[tone]}`}>
      <Icon className="w-4 h-4" />
    </span>
  );
}


// Each kind of update on a post, with its own icon and colour (same on both dashboards).
export const ACTIVITY_STYLE: Record<string, { Icon: LucideIcon; tone: string }> = {
  approved: { Icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  "requested changes on": { Icon: MessageSquareWarning, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  "commented on": { Icon: MessageCircle, tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  submitted: { Icon: Send, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  resubmitted: { Icon: Send, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  "reopened the approval of": { Icon: RotateCcw, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  rescheduled: { Icon: CalendarClock, tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  "dismissed a compliance flag on": { Icon: ShieldCheck, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  withdrew: { Icon: Undo2, tone: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
};

/** An average rulebook score as a ring. */
export function ScoreRing({ score }: { score?: number | null }) {
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const value = score ?? 0;
  const tone =
    score == null
      ? "text-muted-foreground"
      : score >= 80
      ? "text-emerald-500"
      : score >= 60
      ? "text-amber-500"
      : "text-red-500";
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={score == null ? "No score yet" : `Average score ${score} out of 100`}>
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        {score != null && (
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            className={`stroke-current ${tone}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{score ?? "–"}</span>
        <span className="text-[10px] text-muted-foreground">of 100</span>
      </div>
    </div>
  );
}
