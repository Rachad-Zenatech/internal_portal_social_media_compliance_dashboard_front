import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Crown,
  ExternalLink,
  Eye,
  FilePen,
  Inbox,
  LayoutGrid,
  List,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import PostPreview, { ChannelAvatar, CoverThumb } from "@/components/submissions/PostPreview";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import { SubmissionStatusBadge } from "@/components/submissions/submissionUi";
import { useSubmitForReview } from "@/hooks/useSubmitForReview";
import { submissionService } from "@/services/submissionService";
import type { SubmissionStatus, SubmissionSummary } from "@/types/submission";

// ---------------------------------------------------------------------------
// Filters, grouping and sorting
// ---------------------------------------------------------------------------

const STATUS_TILES: { value: string; label: string; hint: string }[] = [
  { value: "", label: "All content", hint: "Everything you've created" },
  { value: "DRAFT", label: "Drafts", hint: "Not sent for review yet" },
  { value: "CHANGES_REQUESTED", label: "Changes requested", hint: "Fix within a day" },
  { value: "IN_REVIEW", label: "In review", hint: "Waiting on reviewers" },
  { value: "APPROVED", label: "Approved", hint: "Ready to post" },
];

type GroupBy = "none" | "platform" | "channel" | "status";
type SortBy = "priority" | "publish" | "updated" | "score";
type ViewMode = "grid" | "list";

const GROUP_LABELS: Record<GroupBy, string> = { none: "No grouping", platform: "Platform", channel: "Channel", status: "Status" };
const SORT_LABELS: Record<SortBy, string> = {
  priority: "Needs action first",
  publish: "Publish date",
  updated: "Recently updated",
  score: "Lowest check score",
};
const STATUS_ORDER: SubmissionStatus[] = ["CHANGES_REQUESTED", "DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"];
const STATUS_NAMES: Record<string, string> = {
  DRAFT: "Drafts",
  IN_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const SUBMITTABLE = new Set(["DRAFT", "CHANGES_REQUESTED"]);
const FINISHED = new Set(["APPROVED", "REJECTED"]);

const PREFS_KEY = "contentPortal.prefs";
type Prefs = { view: ViewMode; groupBy: GroupBy; sort: SortBy };
const DEFAULT_PREFS: Prefs = { view: "grid", groupBy: "none", sort: "priority" };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
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

function channelKey(s: SubmissionSummary) {
  return s.account ? `acc:${s.account.id}` : "none";
}

/** "Posting to" filter: every channel, Shaun's, company, unassigned, or one account. */
function matchesChannel(s: SubmissionSummary, channel: string) {
  if (channel === "all") return true;
  if (channel === "ceo") return Boolean(s.account?.is_ceo);
  if (channel === "company") return Boolean(s.account && !s.account.is_ceo);
  return channelKey(s) === channel;
}

function sortItems(items: SubmissionSummary[], sort: SortBy) {
  if (sort === "priority") return items; // the API already returns needs-action-first order
  const time = (v?: string | null) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);
  const copy = [...items];
  if (sort === "publish") copy.sort((a, b) => time(a.publish_at) - time(b.publish_at));
  if (sort === "updated") copy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (sort === "score") copy.sort((a, b) => (a.latest_score ?? 101) - (b.latest_score ?? 101));
  return copy;
}

interface Group {
  key: string;
  label: string;
  icon?: React.ReactNode;
  items: SubmissionSummary[];
}

function groupItems(items: SubmissionSummary[], groupBy: GroupBy): Group[] {
  if (groupBy === "none") return [{ key: "all", label: "", items }];
  const groups = new Map<string, Group>();
  const add = (key: string, label: string, item: SubmissionSummary, icon?: React.ReactNode) => {
    if (!groups.has(key)) groups.set(key, { key, label, icon, items: [] });
    groups.get(key)!.items.push(item);
  };
  for (const s of items) {
    if (groupBy === "platform") {
      // A post going to several platforms shows under each one.
      if (!s.platforms.length) add("none", "No platform yet", s);
      for (const p of s.platforms) add(p, platformName(p), s, <PlatformIcon platform={p as SocialPlatform} className="w-4 h-4" />);
    } else if (groupBy === "channel") {
      const a = s.account;
      add(
        channelKey(s),
        a ? (a.is_ceo ? `${a.account_name} · Shaun's channel` : a.label) : "No channel yet",
        s,
        a ? <ChannelAvatar account={a} size="sm" /> : undefined
      );
    } else {
      add(s.status, STATUS_NAMES[s.status] ?? s.status, s);
    }
  }
  const list = [...groups.values()];
  if (groupBy === "status") list.sort((a, b) => STATUS_ORDER.indexOf(a.key as SubmissionStatus) - STATUS_ORDER.indexOf(b.key as SubmissionStatus));
  else list.sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : b.items.length - a.items.length));
  return list;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function ScoreChip({ s, overlay = false }: { s: SubmissionSummary; overlay?: boolean }) {
  if (s.latest_score == null) {
    return overlay ? null : <span className="text-xs text-muted-foreground">Not checked</span>;
  }
  const tone =
    s.latest_traffic_light === "RED"
      ? "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border-red-500/40"
      : s.latest_traffic_light === "YELLOW"
      ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border-amber-500/40"
      : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border-emerald-500/40";
  return <span className={`text-[11px] font-semibold rounded-md border px-1.5 py-0.5 tabular-nums ${tone}`}>{s.latest_score}/100</span>;
}

function PublishWhen({ s, compact = false }: { s: SubmissionSummary; compact?: boolean }) {
  if (!s.publish_at) return <span className="text-muted-foreground">Not scheduled</span>;
  const date = new Date(s.publish_at);
  const pastDue = !FINISHED.has(s.status) && isPast(date);
  return (
    <span className={pastDue ? "text-red-600 dark:text-red-400 font-semibold" : "text-foreground"}>
      {format(date, compact ? "MMM d" : "MMM d, h:mm a")}
      <span className={pastDue ? "" : "text-muted-foreground font-normal"}>
        {" · "}
        {pastDue ? "Past due" : formatDistanceToNow(date, { addSuffix: true })}
      </span>
    </span>
  );
}

function ChannelLine({ s }: { s: SubmissionSummary }) {
  const a = s.account;
  if (!a) return <span className="text-[11px] text-muted-foreground">No channel yet</span>;
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      <ChannelAvatar account={a} size="sm" />
      <span className="text-[11px] font-medium text-foreground truncate">{a.account_name}</span>
      {a.handle && <span className="text-[11px] text-muted-foreground truncate">@{a.handle.replace(/^@/, "")}</span>}
      {a.is_ceo && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
          <Crown className="w-2.5 h-2.5" /> CEO
        </span>
      )}
    </span>
  );
}

function PlatformPills({ platforms }: { platforms: string[] }) {
  if (!platforms.length) return null;
  return (
    <span className="flex gap-1">
      {platforms.map((p) => (
        <span key={p} title={platformName(p)} className="w-6 h-6 rounded-full bg-white/95 dark:bg-neutral-900/95 shadow-sm grid place-items-center">
          <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />
        </span>
      ))}
    </span>
  );
}

interface CardActions {
  onPreview: (s: SubmissionSummary) => void;
  onSubmit: (s: SubmissionSummary) => void;
}

function PortalCard({ s, onPreview, onSubmit }: { s: SubmissionSummary } & CardActions) {
  const navigate = useNavigate();
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onPreview(s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview(s);
        }
      }}
      className="group py-0 gap-0 overflow-hidden border-border/80 shadow-xs cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="absolute top-2 left-2">
          <span className="inline-flex rounded-md bg-background/95 shadow-sm">
            <SubmissionStatusBadge status={s.status} />
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <ScoreChip s={s} overlay />
        </div>
        <div className="absolute bottom-2 left-2">
          <PlatformPills platforms={s.platforms} />
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-sm text-foreground truncate">{s.title}</p>
          <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
            {s.reference_code}
            {s.file_count > 0 && (
              <span className="inline-flex items-center gap-0.5 font-sans">
                <Paperclip className="w-3 h-3" /> {s.file_count}
              </span>
            )}
            {s.current_version > 0 && <span className="font-sans">v{s.current_version}</span>}
          </p>
        </div>
        <ChannelLine s={s} />
        <p className="text-[11px] flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <PublishWhen s={s} compact />
        </p>
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => onPreview(s)}>
          <Eye className="w-3.5 h-3.5" /> Preview
        </Button>
        {SUBMITTABLE.has(s.status) && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => navigate(`/submissions/new?id=${s.id}`)}>
            <FilePen className="w-3.5 h-3.5" /> Edit
          </Button>
        )}
        <span className="flex-1" />
        {SUBMITTABLE.has(s.status) ? (
          <Button size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={() => onSubmit(s)}>
            <Send className="w-3.5 h-3.5" /> Send to screener
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" onClick={() => navigate(`/submissions/${s.id}`)}>
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </Button>
        )}
      </div>
    </Card>
  );
}

function PortalRow({ s, onPreview, onSubmit }: { s: SubmissionSummary } & CardActions) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPreview(s)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview(s);
        }
      }}
      className="group flex items-center gap-3 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
    >
      <div className="relative w-24 sm:w-28 aspect-video rounded-md overflow-hidden bg-muted shrink-0">
        <CoverThumb cover={s.cover} contentType={s.content_type} caption={s.caption_text} showPlay={false} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{s.title}</p>
          <span className="text-[11px] text-muted-foreground font-mono shrink-0">{s.reference_code}</span>
        </div>
        <ChannelLine s={s} />
      </div>
      <div className="hidden md:flex gap-1 w-24">
        {s.platforms.map((p) => (
          <span key={p} title={platformName(p)}>
            <PlatformIcon platform={p as SocialPlatform} className="w-4 h-4" />
          </span>
        ))}
      </div>
      <div className="hidden lg:block w-48 text-xs">
        <PublishWhen s={s} compact />
      </div>
      <div className="hidden sm:flex items-center gap-2 w-44 justify-end">
        <ScoreChip s={s} />
        <SubmissionStatusBadge status={s.status} />
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {SUBMITTABLE.has(s.status) ? (
          <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => onSubmit(s)} title="Send to the Content Screener">
            <Send className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Send</span>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPreview(s)} title="Preview">
            <Eye className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

function PreviewSheet({
  summary,
  onClose,
  onSubmit,
}: {
  summary: SubmissionSummary | null;
  onClose: () => void;
  onSubmit: (s: SubmissionSummary) => void;
}) {
  const navigate = useNavigate();
  const id = summary?.id ?? "";
  const { data: sub, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => submissionService.get(id),
    enabled: Boolean(id),
    staleTime: 0,
  });
  const [pickedPlatform, setPickedPlatform] = useState<string | null>(null);

  const platforms = sub?.platforms.length ? sub.platforms : summary?.platforms.length ? summary.platforms : ["LINKEDIN"];
  const platform = pickedPlatform && platforms.includes(pickedPlatform) ? pickedPlatform : platforms[0];
  const media =
    sub?.files.find((f) => f.kind === "MAIN" && /^(video|image)\//.test(f.mime_type)) ??
    sub?.files.find((f) => f.mime_type.startsWith("image/")) ??
    null;
  const check = sub?.latest_check;
  const when = sub?.publish_at ? `Scheduled ${format(new Date(sub.publish_at), "MMM d, h:mm a")}` : "Not scheduled";

  return (
    <Sheet
      open={Boolean(summary)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setPickedPlatform(null);
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-xl p-0 gap-0 flex flex-col">
        {summary && (
          <>
            <SheetHeader className="border-b border-border/70 p-4 pr-12">
              <div className="flex items-center gap-2">
                <SubmissionStatusBadge status={summary.status} />
                <span className="text-[11px] font-mono text-muted-foreground">{summary.reference_code}</span>
              </div>
              <SheetTitle className="text-base leading-snug">{summary.title}</SheetTitle>
              <SheetDescription className="text-xs">Preview of how the post reads on each platform it's going to.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {platforms.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Preview platform">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={p === platform}
                      onClick={() => setPickedPlatform(p)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        p === platform ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />
                      {platformName(p)}
                    </button>
                  ))}
                </div>
              )}

              {isLoading || !sub ? (
                <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading preview...
                </div>
              ) : (
                <PostPreview
                  key={platform}
                  platform={platform}
                  account={sub.account}
                  title={sub.title}
                  caption={sub.caption_text}
                  media={media}
                  whenLabel={when}
                />
              )}

              {sub && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance check</h3>
                  {check ? (
                    <div className="rounded-lg border border-border/80 p-3 space-y-2">
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
                        <div key={v.rule_id} className="text-xs border-t border-border/60 pt-2">
                          <p className="font-semibold text-foreground">
                            {v.rule_number} · {v.title}
                          </p>
                          <p className="text-muted-foreground">Flagged: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not checked yet. The rulebook check runs when it's sent to the screener.</p>
                  )}
                </section>
              )}

              {sub && (
                <section className="rounded-lg border border-border/80 p-3">
                  <SentimentPanel submissionId={sub.id} />
                </section>
              )}

              {sub && (
                <section className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {[
                    ["Brand", sub.brand_code],
                    ["Region", sub.region],
                    ["Rule sets", sub.rule_sets.join(", ")],
                    ["Publish date", sub.publish_at ? format(new Date(sub.publish_at), "MMM d, yyyy h:mm a") : null],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-medium text-foreground">{value || "—"}</p>
                    </div>
                  ))}
                </section>
              )}
            </div>

            <div className="border-t border-border/70 p-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate(`/submissions/${summary.id}`)}>
                <ExternalLink className="w-3.5 h-3.5" /> Full details
              </Button>
              {SUBMITTABLE.has(summary.status) && (
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate(`/submissions/new?id=${summary.id}`)}>
                  <FilePen className="w-3.5 h-3.5" /> Edit draft
                </Button>
              )}
              <span className="flex-1" />
              {SUBMITTABLE.has(summary.status) && (
                <Button size="sm" className="text-xs gap-1" onClick={() => onSubmit(summary)}>
                  <Send className="w-3.5 h-3.5" /> Send to Content Screener
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionsListPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [channel, setChannel] = useState("all");
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [previewing, setPreviewing] = useState<SubmissionSummary | null>(null);
  const [confirming, setConfirming] = useState<SubmissionSummary | null>(null);
  const submit = useSubmitForReview();

  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      savePrefs(next);
      return next;
    });

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["submissions"],
    queryFn: () => submissionService.list(),
    // Statuses change from other screens (autosave, submit); always show the latest.
    staleTime: 0,
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { "": data.length };
    for (const s of data) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [data]);

  // Platform chips and channel options come from what's actually in the list.
  const platformCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of data) for (const p of s.platforms) counts.set(p, (counts.get(p) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);
  const accounts = useMemo(() => {
    const map = new Map<string, NonNullable<SubmissionSummary["account"]>>();
    for (const s of data) if (s.account) map.set(s.account.id, s.account);
    return [...map.values()].sort((a, b) => Number(b.is_ceo) - Number(a.is_ceo) || a.label.localeCompare(b.label));
  }, [data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter(
      (s) =>
        (!status || s.status === status) &&
        (platform === "all" || s.platforms.includes(platform)) &&
        matchesChannel(s, channel) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.reference_code.toLowerCase().includes(q) ||
          (s.caption_text ?? "").toLowerCase().includes(q) ||
          (s.account?.account_name ?? "").toLowerCase().includes(q))
    );
    return sortItems(filtered, prefs.sort);
  }, [data, status, platform, channel, search, prefs.sort]);

  const groups = useMemo(() => groupItems(visible, prefs.groupBy), [visible, prefs.groupBy]);
  const filtersActive = Boolean(status || search || platform !== "all" || channel !== "all");
  const clearFilters = () => {
    setStatus("");
    setSearch("");
    setPlatform("all");
    setChannel("all");
  };

  const actions: CardActions = { onPreview: setPreviewing, onSubmit: setConfirming };

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title="Content Portal"
        subtitle="Everything you're creating, in review or ready to post. Filter by platform and channel, preview posts, and send drafts to the Content Screener."
        actions={
          <Button size="sm" asChild className="gap-1.5 text-xs font-semibold">
            <Link to="/submissions/new">
              <Plus className="w-4 h-4" /> New submission
            </Link>
          </Button>
        }
      />

      {/* Status tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {STATUS_TILES.map((t) => {
          const count = statusCounts[t.value] ?? 0;
          const active = status === t.value;
          const urgent = t.value === "CHANGES_REQUESTED" && count > 0;
          return (
            <button
              key={t.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(active && t.value ? "" : t.value)}
              className={`text-left rounded-xl border p-3 transition-all ${
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : urgent
                  ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                  : "border-border bg-card hover:border-primary/40 hover:shadow-xs"
              }`}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${active ? "opacity-80" : urgent ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                {t.label}
              </p>
              <p className="text-2xl font-bold tabular-nums leading-tight">{isLoading ? "–" : count}</p>
              <p className={`text-[11px] ${active ? "opacity-70" : "text-muted-foreground"}`}>{t.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <Card className="p-3 gap-3 border-border/80 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, reference, caption or channel..."
              className="pl-9 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-full sm:w-[210px] text-xs" aria-label="Posting to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Posting to: all channels</SelectItem>
                <SelectItem value="ceo" className="text-xs">Shaun's channels</SelectItem>
                <SelectItem value="company" className="text-xs">Company channels</SelectItem>
                <SelectItem value="none" className="text-xs">No channel yet</SelectItem>
                {accounts.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px]">Channels</SelectLabel>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={`acc:${a.id}`} className="text-xs">
                        {a.is_ceo ? `★ ${a.label}` : a.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <Select value={prefs.groupBy} onValueChange={(v) => setPrefs({ groupBy: v as GroupBy })}>
              <SelectTrigger className="w-[150px] text-xs" aria-label="Group by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
                  <SelectItem key={g} value={g} className="text-xs">
                    {g === "none" ? GROUP_LABELS[g] : `Group: ${GROUP_LABELS[g]}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={prefs.sort} onValueChange={(v) => setPrefs({ sort: v as SortBy })}>
              <SelectTrigger className="w-[180px] text-xs" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    Sort: {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="View">
              {(
                [
                  ["grid", LayoutGrid, "Grid view"],
                  ["list", List, "List view"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={prefs.view === v}
                  title={label}
                  onClick={() => setPrefs({ view: v })}
                  className={`rounded px-2 py-1 transition-colors ${prefs.view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Platform chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[["all", data.length] as const, ...platformCounts].map(([p, count]) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              onClick={() => setPlatform(platform === p && p !== "all" ? "all" : p)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                platform === p ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {p !== "all" && <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />}
              {p === "all" ? "All platforms" : platformName(p)}
              <span className="font-normal opacity-70 tabular-nums">{count}</span>
            </button>
          ))}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading content...
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-sm text-red-600">Couldn't load content: {(error as Error).message}</div>
      ) : visible.length === 0 ? (
        <Card className="py-16 text-center space-y-3 border-dashed">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {data.length === 0 ? "You haven't created any content yet." : "Nothing matches these filters."}
          </p>
          <div>
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
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2.5">
              {g.label && (
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {g.icon}
                  {g.label}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{g.items.length}</span>
                </h2>
              )}
              {prefs.view === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
                  {g.items.map((s) => (
                    <PortalCard key={`${g.key}-${s.id}`} s={s} {...actions} />
                  ))}
                </div>
              ) : (
                <Card className="py-0 gap-0 overflow-hidden border-border/80 shadow-xs divide-y divide-border/60">
                  {g.items.map((s) => (
                    <PortalRow key={`${g.key}-${s.id}`} s={s} {...actions} />
                  ))}
                </Card>
              )}
            </section>
          ))}
        </div>
      )}

      <PreviewSheet summary={previewing} onClose={() => setPreviewing(null)} onSubmit={setConfirming} />

      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4" /> Send {confirming?.reference_code} to the Content Screener?
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
                submit.mutate(
                  {
                    id: target.id,
                    referenceCode: target.reference_code,
                    isVideo: Boolean(target.cover?.kind === "MAIN" && target.cover.mime_type.startsWith("video/")),
                  },
                  { onSuccess: () => setPreviewing(null) }
                );
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
