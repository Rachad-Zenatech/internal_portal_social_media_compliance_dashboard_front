import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FilePen,
  Inbox,
  Loader2,
  MessageCircle,
  Plus,
  ScanEye,
  Search,
  Send,
  Trash2,
  User as UserIcon,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { ChannelAvatar, CoverThumb } from "@/components/submissions/PostPreview";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import ReviewCommentsPanel from "@/components/submissions/ReviewCommentsPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import DeleteDraftDialog from "@/components/submissions/DeleteDraftDialog";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { useAuth } from "@/lib/AuthContext";
import { useSubmitForReview } from "@/hooks/useSubmitForReview";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { submissionService } from "@/services/submissionService";
import type { Submission, SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// Stages, filters and sorting
// ---------------------------------------------------------------------------

/** The status as the team thinks of it: approved content with a future publish date is "Scheduled". */
type Stage = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "REJECTED";

function stageOf(s: { status: string; publish_at?: string | null }): Stage {
  if (s.status === "APPROVED" && s.publish_at && !isPast(new Date(s.publish_at))) return "SCHEDULED";
  return s.status as Stage;
}

const STAGES: Record<Stage, { label: string; pill: string }> = {
  DRAFT: { label: "Draft", pill: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" },
  IN_REVIEW: { label: "In Review", pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  CHANGES_REQUESTED: { label: "Changes Requested", pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Approved", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  REJECTED: { label: "Rejected", pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
};

const STAGE_TILES: { value: "" | Stage; label: string; tint: string }[] = [
  { value: "", label: "All Content", tint: "bg-card" },
  { value: "DRAFT", label: "Drafts", tint: "bg-card" },
  { value: "IN_REVIEW", label: "In Review", tint: "bg-orange-50/80 dark:bg-orange-500/5" },
  { value: "CHANGES_REQUESTED", label: "Changes Requested", tint: "bg-red-50/80 dark:bg-red-500/5" },
  { value: "APPROVED", label: "Approved", tint: "bg-emerald-50/80 dark:bg-emerald-500/5" },
  { value: "SCHEDULED", label: "Scheduled", tint: "bg-violet-50/80 dark:bg-violet-500/5" },
];

type SortBy = "priority" | "updated" | "publish" | "score";
const SORT_LABELS: Record<SortBy, string> = {
  priority: "Needs action first",
  updated: "Newest first",
  publish: "Publish date",
  score: "Lowest check score",
};
const SUBMITTABLE = new Set(["DRAFT", "CHANGES_REQUESTED"]);
const FINISHED = new Set(["APPROVED", "REJECTED"]);

const PREFS_KEY = "contentPortal.prefs";
type Prefs = { sort: SortBy; scope: "mine" | "all" };
const DEFAULT_PREFS: Prefs = { sort: "priority", scope: "mine" };

function loadPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return { ...DEFAULT_PREFS, ...saved, sort: saved.sort in SORT_LABELS ? saved.sort : DEFAULT_PREFS.sort };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // preferences just won't persist
  }
}

const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

function sortItems(items: SubmissionSummary[], sort: SortBy) {
  if (sort === "priority") return items; // the API already returns needs-action-first order
  const time = (v?: string | null) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);
  const copy = [...items];
  if (sort === "publish") copy.sort((a, b) => time(a.publish_at) - time(b.publish_at));
  if (sort === "updated") copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (sort === "score") copy.sort((a, b) => (a.latest_score ?? 101) - (b.latest_score ?? 101));
  return copy;
}

/** Every account it posts through; older data may only have the single primary one. */
const accountsOf = (s: SubmissionSummary | Submission) => (s.accounts?.length ? s.accounts : s.account ? [s.account] : []);

const isVideo = (s: SubmissionSummary) => Boolean(s.cover?.kind === "MAIN" && s.cover.mime_type.startsWith("video/"));
const submitLabel = (s: { status: string }) => (s.status === "CHANGES_REQUESTED" ? "Resubmit" : "Send for review");

/** Side-by-side list and detail from this width; below it the detail opens as a sheet. */
const WIDE_QUERY = "(min-width: 1280px)";

function useIsWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return wide;
}

/** Names for brand and audience codes, from the same options New Submission uses. */
interface Labels {
  brand: (code?: string | null) => string | null;
  audience: (code?: string | null) => string | null;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function StagePill({ stage, small = false }: { stage: Stage; small?: boolean }) {
  const st = STAGES[stage] ?? { label: stage, pill: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap ${small ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} ${st.pill}`}>
      {st.label}
    </span>
  );
}

/** Platform | brand | audience, each with its icon, separated by thin rules. */
function MetaLine({ s, labels, date, className = "" }: { s: SubmissionSummary | Submission; labels: Labels; date?: React.ReactNode; className?: string }) {
  const parts: React.ReactNode[] = [];
  if (s.platforms.length) {
    parts.push(
      <span key="p" className="inline-flex items-center gap-1.5">
        <PlatformIcon platform={s.platforms[0] as SocialPlatform} className="w-3.5 h-3.5" />
        {platformName(s.platforms[0])}
        {s.platforms.length > 1 && <span className="text-muted-foreground/80">+{s.platforms.length - 1}</span>}
      </span>
    );
  }
  const brand = labels.brand(s.brand_code);
  if (brand) {
    parts.push(
      <span key="b" className="inline-flex items-center gap-1.5">
        <Building2 className="w-3.5 h-3.5" /> {brand}
      </span>
    );
  }
  const audience = labels.audience(s.audience);
  if (audience) {
    parts.push(
      <span key="a" className="inline-flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5" /> {audience}
      </span>
    );
  }
  if (date) parts.push(<span key="d" className="inline-flex items-center gap-1.5">{date}</span>);
  if (!parts.length) return null;
  return (
    <p className={`flex flex-wrap items-center gap-y-1 text-xs text-muted-foreground ${className}`}>
      {parts.map((part, i) => (
        <span key={i} className={`inline-flex items-center ${i > 0 ? "ml-2.5 border-l border-border pl-2.5" : ""}`}>
          {part}
        </span>
      ))}
    </p>
  );
}

/** Publish date when it has one (red when it's passed without being approved), otherwise last activity. */
function WhenText({ s }: { s: SubmissionSummary }) {
  if (s.publish_at) {
    const date = new Date(s.publish_at);
    const pastDue = !FINISHED.has(s.status) && isPast(date);
    return (
      <span className={pastDue ? "text-red-600 dark:text-red-400 font-semibold" : ""} title={pastDue ? "Planned publish time has passed" : "Planned publish time"}>
        {format(date, "MMM d, yyyy, h:mm a")}
        {pastDue && " · Past due"}
      </span>
    );
  }
  return <span title="Last updated">{format(new Date(s.updated_at), "MMM d, yyyy, h:mm a")}</span>;
}

// ---------------------------------------------------------------------------
// List row
// ---------------------------------------------------------------------------

function ContentRow({
  s,
  selected,
  labels,
  showCreator,
  onSelect,
}: {
  s: SubmissionSummary;
  selected: boolean;
  labels: Labels;
  showCreator: boolean;
  onSelect: (s: SubmissionSummary) => void;
}) {
  const stage = stageOf(s);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(s);
        }
      }}
      className={`group flex gap-4 rounded-xl border p-3 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected
          ? "border-blue-400 bg-blue-50/70 ring-1 ring-blue-300 dark:border-blue-500/60 dark:bg-blue-500/10 dark:ring-blue-500/40"
          : "border-border/70 bg-card hover:border-blue-200 hover:shadow-sm dark:hover:border-blue-500/40"
      }`}
    >
      <div className="relative w-28 sm:w-36 aspect-[4/3] shrink-0 overflow-hidden rounded-lg bg-muted">
        <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-bold text-sm sm:text-base text-foreground truncate">{s.title}</p>
        <MetaLine s={s} labels={labels} className="mt-1.5" />
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2">{s.caption_text?.trim() || "No caption yet."}</p>
        {showCreator && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <UserIcon className="w-3 h-3" /> By {s.created_by_name || "unknown"}
          </p>
        )}
        {/* Phones: status and date sit under the text instead of in their own column. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground md:hidden">
          <StagePill stage={stage} small />
          <WhenText s={s} />
        </div>
      </div>

      <div className="hidden md:flex w-48 shrink-0 flex-col items-start justify-between gap-2 py-0.5 text-xs text-muted-foreground">
        <StagePill stage={stage} small />
        <WhenText s={s} />
        <span className="inline-flex items-center gap-1.5" title="Review comments">
          <MessageCircle className="w-4 h-4" /> {s.comment_count ?? 0}
        </span>
      </div>

      <ChevronRight
        className={`hidden sm:block w-4 h-4 shrink-0 self-center transition-transform group-hover:translate-x-0.5 ${selected ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground/60"}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel: media, tabs and the actions for whoever is looking
// ---------------------------------------------------------------------------

function ComplianceView({ sub }: { sub: Submission }) {
  const check = sub.latest_check;
  if (!check) {
    return <p className="text-xs text-muted-foreground">Not checked yet. The rulebook check runs when it's sent for review.</p>;
  }
  return (
    <div className="rounded-xl border border-border/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          {check.traffic_light === "RED" ? (
            <XCircle className="w-4 h-4 text-red-600" />
          ) : check.traffic_light === "YELLOW" ? (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
          {check.is_compliant ? "No issues found" : `${check.violations_count} potential issue${check.violations_count === 1 ? "" : "s"}`}
        </span>
        <span className="tabular-nums">{check.score}/100</span>
      </div>
      {check.violations.map((v) => (
        <div key={v.rule_id} className="text-xs border-t border-border/60 pt-2.5">
          <p className="font-semibold text-foreground">
            {v.rule_number} · {v.title}
          </p>
          <p className="text-muted-foreground">Flagged: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}</p>
        </div>
      ))}
    </div>
  );
}

function DetailsView({ sub, labels }: { sub: Submission; labels: Labels }) {
  const rows: [string, React.ReactNode][] = [
    ["Reference", <span className="font-mono">{sub.reference_code}</span>],
    ["Brand", labels.brand(sub.brand_code)],
    ["Audience", labels.audience(sub.audience)],
    ["Region", sub.region],
    ["Platforms", sub.platforms.map(platformName).join(", ")],
    [
      "Posting to",
      accountsOf(sub).length ? (
        <span className="flex flex-col gap-1">
          {accountsOf(sub).map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1.5">
              <ChannelAvatar account={a} size="sm" /> {a.label}
            </span>
          ))}
        </span>
      ) : null,
    ],
    ["Rule sets", sub.rule_sets.join(", ")],
    ["Publish date", sub.publish_at ? format(new Date(sub.publish_at), "MMM d, yyyy, h:mm a") : null],
    ["Created by", sub.created_by_name],
    ["Version", sub.current_version ? `v${sub.current_version}` : "Not submitted yet"],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 font-medium text-foreground break-words">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistoryView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["submission-history", id],
    queryFn: () => submissionService.history(id),
    staleTime: 0,
  });
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history...
      </p>
    );
  }
  const events = data?.events ?? [];
  if (!events.length) return <p className="text-xs text-muted-foreground">No history yet.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((e) => (
        <li key={e.id} className="text-xs">
          <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-blue-500" />
          <p className="font-medium text-foreground">{e.message}</p>
          <p className="text-muted-foreground">
            {e.actor_name ? `${e.actor_name} · ` : ""}
            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
          </p>
        </li>
      ))}
    </ol>
  );
}

function DetailPanel({
  summary,
  labels,
  userId,
  canComment,
  onSubmit,
  onDelete,
}: {
  summary: SubmissionSummary;
  labels: Labels;
  userId?: string;
  /** Reviewers can comment on anyone's content; creators on their own. */
  canComment: boolean;
  onSubmit: (s: SubmissionSummary) => void;
  onDelete: (s: SubmissionSummary) => void;
}) {
  const navigate = useNavigate();
  const { setActiveVideoId } = useVideoUploadQueue();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined);
  const { data: sub, isLoading } = useQuery({
    queryKey: ["submission", summary.id],
    queryFn: () => submissionService.get(summary.id),
    staleTime: 0,
  });
  const mine = summary.created_by === userId;
  const stage = stageOf(sub ?? summary);
  const media =
    sub?.files.find((f) => f.kind === "MAIN" && /^(video|image)\//.test(f.mime_type)) ??
    sub?.files.find((f) => f.mime_type.startsWith("image/")) ??
    null;
  const mediaIsVideo = Boolean(media?.mime_type.startsWith("video/"));
  const seek = mediaIsVideo
    ? (sec: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = sec;
        void v.play().catch(() => undefined);
      }
    : undefined;
  const commentCount = summary.comment_count ?? 0;

  return (
    <div className="space-y-4">
      {/* Media */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900">
        {media && mediaIsVideo ? (
          <video
            key={media.id}
            ref={videoRef}
            src={authedFileUrl(media.url)}
            controls
            preload="metadata"
            className="h-full w-full object-contain"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
        ) : media ? (
          <img src={authedFileUrl(media.url)} alt="" className="h-full w-full object-contain" />
        ) : (
          <CoverThumb cover={summary.cover} contentType={summary.content_type} caption={summary.caption_text} showPlay={false} />
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug text-foreground">{summary.title}</h2>
          <StagePill stage={stage} small />
        </div>
        <MetaLine
          s={sub ?? summary}
          labels={labels}
          date={
            <>
              <CalendarClock className="w-3.5 h-3.5" /> <WhenText s={summary} />
            </>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="feedback" className="gap-3">
        <div className="overflow-x-auto border-b border-border/70">
          <TabsList variant="line" className="h-10 w-max">
            {[
              ["feedback", `Review Feedback (${commentCount})`],
              ["compliance", "Compliance Check"],
              ["sentiment", "Sentiment Analysis"],
              ["details", "Details"],
              ["history", "Version History"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none px-2 text-xs sm:text-sm data-active:text-blue-700 dark:data-active:text-blue-300 after:bg-blue-600"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {isLoading || !sub ? (
          <p className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </p>
        ) : (
          <>
            <TabsContent value="feedback">
              <ReviewCommentsPanel
                submissionId={sub.id}
                canComment={canComment || mine}
                currentTime={mediaIsVideo ? currentTime ?? 0 : undefined}
                onSeek={seek}
                emptyText={sub.status === "DRAFT" ? "No feedback yet. Reviewers comment here once it's sent for review." : "No feedback yet."}
              />
            </TabsContent>
            <TabsContent value="compliance">
              <ComplianceView sub={sub} />
            </TabsContent>
            <TabsContent value="sentiment">
              <SentimentPanel submissionId={sub.id} onSeek={seek} />
            </TabsContent>
            <TabsContent value="details">
              <DetailsView sub={sub} labels={labels} />
            </TabsContent>
            <TabsContent value="history">
              <HistoryView id={sub.id} />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Actions for whoever is looking */}
      <div className="space-y-2 border-t border-border/70 pt-4">
        {sub?.can_review ? (
          <ReviewDecisionPanel
            layout="bar"
            target={{
              id: sub.id,
              reference_code: sub.reference_code,
              title: sub.title,
              status: sub.status,
              current_version: sub.current_version,
              platforms: sub.platforms,
              publish_at: sub.publish_at,
              can_review: sub.can_review,
              score: sub.latest_check?.score ?? null,
            }}
          />
        ) : SUBMITTABLE.has(summary.status) && mine ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-lg text-sm font-semibold gap-1.5" onClick={() => navigate(`/submissions/new?id=${summary.id}`)}>
              <FilePen className="w-4 h-4" /> {summary.status === "CHANGES_REQUESTED" ? "Make changes" : "Edit draft"}
            </Button>
            <Button className="h-11 rounded-lg text-sm font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => onSubmit(summary)}>
              <Send className="w-4 h-4" /> {submitLabel(summary)}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => navigate(`/submissions/${summary.id}`)}>
            <ExternalLink className="w-3.5 h-3.5" /> Full details
          </button>
          {isVideo(summary) && summary.status !== "DRAFT" && (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-300"
              onClick={() => {
                setActiveVideoId(`sub-${summary.id}`);
                navigate("/compliance/scanner");
              }}
            >
              <ScanEye className="w-3.5 h-3.5" /> Open in Content Screener
            </button>
          )}
          {summary.can_delete && (
            <button type="button" className="ml-auto inline-flex items-center gap-1 font-semibold text-red-600 hover:underline" onClick={() => onDelete(summary)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionsListPage() {
  const [stage, setStage] = useState<"" | Stage>("");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [brand, setBrand] = useState("all");
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SubmissionSummary | null>(null);
  const [deleting, setDeleting] = useState<SubmissionSummary | null>(null);
  const isWide = useIsWide();
  const submit = useSubmitForReview();
  // Super admins, Content Managers and reviewers can switch to everyone's content.
  const { hasPermission, user } = useAuth();
  const canSeeAll = hasPermission("CONTENT_SUBMISSIONS_VIEW") || hasPermission("CONTENT_REVIEW_APPROVE");
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");

  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  const scope = canSeeAll ? prefs.scope : "mine";
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    // Statuses change from other screens (autosave, submit); always show the latest.
    staleTime: 0,
  });
  const { data: options } = useQuery({
    queryKey: ["submission-options"],
    queryFn: submissionService.getOptions,
    staleTime: 5 * 60_000,
  });
  const labels: Labels = useMemo(
    () => ({
      brand: (code) => (code ? options?.brands.find((b) => b.code === code)?.name ?? code : null),
      audience: (code) => (code ? options?.audiences[code] ?? code : null),
    }),
    [options]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { "": data.length };
    for (const s of data) {
      const st = stageOf(s);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  // Filter options come from what's actually in the list.
  const platformsInList = useMemo(() => [...new Set(data.flatMap((s) => s.platforms))].sort(), [data]);
  const brandsInList = useMemo(() => [...new Set(data.map((s) => s.brand_code).filter(Boolean) as string[])].sort(), [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter(
      (s) =>
        (!stage || stageOf(s) === stage) &&
        (platform === "all" || s.platforms.includes(platform)) &&
        (brand === "all" || s.brand_code === brand) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.reference_code.toLowerCase().includes(q) ||
          (s.caption_text ?? "").toLowerCase().includes(q) ||
          accountsOf(s).some((a) => a.account_name.toLowerCase().includes(q)) ||
          (s.created_by_name ?? "").toLowerCase().includes(q))
    );
    return sortItems(filtered, prefs.sort);
  }, [data, stage, platform, brand, search, prefs.sort]);

  // Wide screens always show something in the panel: the picked item, or the first one in the list.
  const picked = visible.find((s) => s.id === selectedId) ?? null;
  const selected = picked ?? (isWide ? visible[0] ?? null : null);

  const filtersActive = Boolean(stage || search || platform !== "all" || brand !== "all");
  const clearFilters = () => {
    setStage("");
    setSearch("");
    setPlatform("all");
    setBrand("all");
  };
  const waitingForMe = data.filter((s) => s.can_review).length;

  const panel = (s: SubmissionSummary) => (
    <DetailPanel
      key={s.id}
      summary={s}
      labels={labels}
      userId={user?.id}
      canComment={isReviewer}
      onSubmit={setConfirming}
      onDelete={setDeleting}
    />
  );

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Content Portal</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isReviewer ? "Review submitted content, run compliance checks, and manage approvals." : "Create content, send it for review, and follow it through to approval."}
            {waitingForMe > 0 && (
              <button type="button" onClick={() => setStage("IN_REVIEW")} className="ml-2 font-semibold text-blue-700 hover:underline dark:text-blue-300">
                {waitingForMe} waiting for your review
              </button>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSeeAll && (
            <div className="inline-flex rounded-lg border border-border/70 bg-card p-1" role="group" aria-label="Whose content">
              {(
                [
                  ["mine", UserIcon, "My content"],
                  ["all", Users, "Everyone's"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={scope === v}
                  onClick={() => setPrefs({ scope: v })}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    scope === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
          <Button asChild className="h-11 rounded-lg px-5 gap-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
            <Link to="/submissions/new">
              <Plus className="w-4 h-4" /> New Submission
            </Link>
          </Button>
        </div>
      </header>

      {/* Status tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGE_TILES.map((t) => {
          const active = stage === t.value;
          return (
            <button
              key={t.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setStage(active && t.value ? "" : t.value)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                active
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300 dark:border-blue-500/60 dark:bg-blue-500/10 dark:ring-blue-500/40"
                  : `border-border/60 hover:border-blue-200 hover:shadow-sm dark:hover:border-blue-500/40 ${t.tint}`
              }`}
            >
              <span className={`block text-xs font-medium ${active ? "text-blue-700 dark:text-blue-300" : "text-foreground/80"}`}>{t.label}</span>
              <span className="mt-0.5 block text-2xl font-bold tabular-nums text-foreground">{isLoading ? "–" : stageCounts[t.value] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-6">
        {/* List */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, reference, caption or channel..."
                aria-label="Search content"
                className="h-10 rounded-lg pl-10 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-10 w-full lg:w-[150px] rounded-lg text-xs" aria-label="Platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                  {platformsInList.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {platformName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="h-10 w-full lg:w-[140px] rounded-lg text-xs" aria-label="Brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Brands</SelectItem>
                  {brandsInList.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {labels.brand(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stage || "all"} onValueChange={(v) => setStage(v === "all" ? "" : (v as Stage))}>
                <SelectTrigger className="h-10 w-full lg:w-[160px] rounded-lg text-xs" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                  {(Object.keys(STAGES) as Stage[]).map((st) => (
                    <SelectItem key={st} value={st} className="text-xs">
                      {STAGES[st].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={prefs.sort} onValueChange={(v) => setPrefs({ sort: v as SortBy })}>
                <SelectTrigger className="h-10 w-full lg:w-[170px] rounded-lg text-xs" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading content...
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-sm text-red-600">Couldn't load content: {(error as Error).message}</div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center space-y-3">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {data.length === 0
                  ? scope === "all"
                    ? "No one has created any content yet."
                    : "You haven't created any content yet."
                  : "Nothing matches these filters."}
              </p>
              {data.length === 0 ? (
                <Button size="sm" variant="outline" asChild className="text-xs">
                  <Link to="/submissions/new">Start a submission</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-xs" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((s) => (
                <ContentRow
                  key={s.id}
                  s={s}
                  selected={selected?.id === s.id}
                  labels={labels}
                  showCreator={scope === "all"}
                  onSelect={(item) => setSelectedId(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel (wide screens) */}
        {isWide && selected && (
          <aside className="sticky top-0 w-[42%] max-w-[620px] shrink-0 border-l border-border/70 pl-6">{panel(selected)}</aside>
        )}
      </div>

      {/* Detail sheet (narrower screens) */}
      <Sheet open={!isWide && Boolean(picked)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-4">
          <SheetHeader className="sr-only">
            <SheetTitle>{picked?.title ?? "Content"}</SheetTitle>
            <SheetDescription>Review feedback, compliance check and details</SheetDescription>
          </SheetHeader>
          {picked && panel(picked)}
        </SheetContent>
      </Sheet>

      <DeleteDraftDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={() => setSelectedId(null)} />

      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4" /> Send {confirming?.reference_code} for review?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <span className="block">
                <strong>{confirming?.title}</strong> is submitted for compliance review as version {(confirming?.current_version ?? 0) + 1}. The
                rulebook check runs right away.
              </span>
              <span className="block">You can withdraw it later if you need to make changes.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs gap-1"
              onClick={() => {
                if (!confirming) return;
                const target = confirming;
                submit.mutate({
                  id: target.id,
                  referenceCode: target.reference_code,
                  isVideo: isVideo(target),
                });
                setConfirming(null);
              }}
            >
              <Send className="w-3.5 h-3.5" /> Send for review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
