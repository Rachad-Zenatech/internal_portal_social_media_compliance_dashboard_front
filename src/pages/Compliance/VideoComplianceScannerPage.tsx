import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  FileText,
  Volume2,
  VolumeX,
  Check,
  Download,
  Zap,
  Copy,
  Hash,
  MessageSquare,
  Send,
  Trash2,
  User as UserIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
  Radio,
  SkipBack,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Search,
  MoreHorizontal,
  MoreVertical,
  FilePlus2,
  ExternalLink,
  Settings,
  Maximize,
  Minimize,
  Film,
  Layers,
  Hourglass,
  MessageSquareWarning,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PlatformIcon, { PLATFORM_LABELS } from "@/components/video/PlatformIcon";
import DemoPoster from "@/components/video/DemoPoster";
import { useVideoThumbnail } from "@/lib/videoThumbnail";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import {
  applySegmentRisk,
  useVideoUploadQueue,
  type TargetPlatform,
  type TimestampedSegment,
  type VideoQueueItem,
  SCREENER_PLATFORMS,
  versionQueueItem,
} from "@/context/VideoUploadQueueContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import ReviewDecisionPanel from "@/components/submissions/ReviewDecisionPanel";
import { DueBadge } from "@/components/submissions/submissionUi";
import ScoreBreakdown from "@/components/submissions/ScoreBreakdown";
import CheckCoverage from "@/components/submissions/CheckCoverage";
import FlagReviewControl from "@/components/submissions/FlagReviewControl";
import ApprovalActions from "@/components/submissions/ApprovalActions";
import type { QueueTab } from "@/types/submission";
import { useReviewComments } from "@/hooks/useReview";
import { format, formatDistanceToNow } from "date-fns";
import {
  complianceService,
  type ComplianceCheckResponse,
  type ComplianceViolation,
  type VideoJob,
} from "@/services/complianceService";

export type CommentCategory = "LEGAL" | "EDITORIAL" | "COMPLIANCE" | "NOTE";

export interface ReviewerComment {
  id: string;
  author: string;
  timestampSec: number | null;
  endTimestampSec?: number | null;
  category: CommentCategory;
  text: string;
  createdAt: string;
  /** Submitted videos: saved comments can only be deleted by their author. */
  canDelete?: boolean;
  resolved?: boolean;
}

// Example reviewer notes shown on the built-in demo videos.
const SAMPLE_COMMENTS: ReviewerComment[] = [
    {
      id: "comm-1",
      author: "Legal Counsel",
      timestampSec: 9,
      endTimestampSec: 19,
      category: "LEGAL",
      text: "Replace 'partnered with the U.S. Army' with 'field-tested under active evaluation agreements' to satisfy non-endorsement standards.",
      createdAt: "Today at 2:15 PM",
    },
    {
      id: "comm-2",
      author: "PR & Comms Lead",
      timestampSec: 20,
      endTimestampSec: 32,
      category: "EDITORIAL",
      text: "Soften commentary on Pentagon procurement—align with positive defense innovation framing.",
      createdAt: "Today at 2:20 PM",
    },
    {
      id: "comm-3",
      author: "Social Media Producer",
      timestampSec: 47,
      endTimestampSec: 60,
      category: "NOTE",
      text: "Ensure URL text overlay stays within TikTok 9:16 safe area (avoid bottom caption zone).",
      createdAt: "Today at 2:25 PM",
    },
];
const NO_COMMENTS: ReviewerComment[] = [];

const MANDATORY_DOD_DISCLAIMER =
  "The appearance of U.S. Department of Defense (DoD) visual information does not imply or constitute DoD endorsement.";

const SAMPLE_DEMO_SEGMENTS: TimestampedSegment[] = [
  {
    id: "seg-1",
    startSec: 0,
    endSec: 8,
    text: "Welcome to ZenaDrone. Today we showcase our next-generation autonomous flight telemetry in real-time field trials.",
    risk: "GREEN",
  },
  {
    id: "seg-2",
    startSec: 9,
    endSec: 19,
    text: "ZenaDrone has partnered with the U.S. Army to deliver combat-proven autonomous swarm logistics across front-line operations.",
    risk: "RED",
  },
  {
    id: "seg-3",
    startSec: 20,
    endSec: 32,
    text: "Pentagon procurement is failing our warfighters, but our fielded drone system is already adopted by active military commanders.",
    risk: "RED",
  },
  {
    id: "seg-4",
    startSec: 33,
    endSec: 46,
    text: "With sub-second dual sensor payloads, the ZenaDrone 1000 provides unjammable target locking under extreme ECM warfare environments.",
    risk: "YELLOW",
  },
  {
    id: "seg-5",
    startSec: 47,
    endSec: 60,
    text: "For more details on commercial autonomous logistics and civil infrastructure defense applications, visit zenatech.com.",
    risk: "GREEN",
  },
];

/** Card thumbnail: the most representative frame of an uploaded video, or the demo illustration. */
function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Queue paging: posts per page when the queue sits above the player, and the spacing used to fit it beside it.
const QUEUE_PAGE_SIZE_STACKED = 6;
const QUEUE_GAP = 12; // gap-3
const QUEUE_PAGER_HEIGHT = 56; // the page controls plus the gap above them

// Caption length each platform allows (as in the submission form).
const CAPTION_LIMITS: Partial<Record<TargetPlatform, number>> = {
  X: 280,
  TIKTOK: 2200,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
  YOUTUBE: 5000,
  YOUTUBE_SHORTS: 5000,
  FACEBOOK: 63206,
  REDDIT: 40000,
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  VIDEO: "Video",
  SOCIAL_POST: "Social post",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
  BLOG: "Blog",
  AD: "Paid ad",
};

function QueueThumbnail({
  item,
  fallbackDuration,
}: {
  item: Pick<VideoQueueItem, "videoUrl" | "posterVariant" | "submissionId" | "images" | "caption" | "title" | "contentType">;
  fallbackDuration: number;
}) {
  const { dataUrl, duration } = useVideoThumbnail(item.videoUrl);
  const still = Boolean(item.submissionId && !item.videoUrl);
  const shownDuration = still ? 0 : duration ?? fallbackDuration;
  const cover = item.images?.[0];
  return (
    <>
      {item.videoUrl ? (
        dataUrl ? (
          // Letterbox the frame so it keeps the video's native aspect ratio instead of being cropped to the card
          <img src={dataUrl} alt="" className="absolute inset-0 w-full h-full object-contain bg-black" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
          </div>
        )
      ) : still && cover ? (
        <img src={cover.url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover bg-zinc-900" />
      ) : still ? (
        // A text post: its caption stands in for a picture.
        <div className="absolute inset-0 flex flex-col gap-1 bg-gradient-to-br from-slate-800 to-slate-950 p-2.5 text-left">
          <FileText className="w-3.5 h-3.5 shrink-0 text-white/60" />
          <p className="line-clamp-4 text-[10px] leading-snug text-white/85">{item.caption?.trim() || item.title}</p>
        </div>
      ) : (
        <DemoPoster variant={item.posterVariant} className="absolute inset-0 w-full h-full" />
      )}
      {shownDuration > 0 && (
        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white font-mono">
          {formatTime(shownDuration)}
        </span>
      )}
    </>
  );
}

/** An image, carousel or text post in the review area, in place of the video player. */
function PostStillPreview({ item }: { item: VideoQueueItem }) {
  const images = item.images ?? [];
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(0, images.length - 1));
  const image = images[at];
  return (
    <div className="mx-4 rounded-xl bg-muted/50 border border-border/60 p-3 space-y-3">
      {image ? (
        <div className="space-y-2">
          <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-zinc-950 h-[min(60vh,560px)]">
            <img src={image.url} alt={image.name} className="max-h-full max-w-full object-contain" />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((at - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((at + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                  {at + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Image ${i + 1}: ${img.name}`}
                  aria-current={i === at}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                    i === at ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          <FileText className="w-4 h-4 shrink-0" /> No image or video is attached, so the title and caption below are what's reviewed.
        </div>
      )}
      <div className="rounded-lg bg-background border border-border/70 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Caption</p>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{item.caption?.trim() || "No caption."}</p>
      </div>
    </div>
  );
}

export default function VideoComplianceScannerPage() {
  const { user, hasPermission, creatorView } = useAuth();
  // Demo tools (sample videos, simulated uploads) are for super admins setting up or demonstrating the app.
  const canUseDemo = Boolean(user?.is_super_admin) && !creatorView;
  const authorName = user?.full_name || "Marketing Reviewer";
  const navigate = useNavigate();
  const {
    queue,
    activeVideo: latestVideo,
    activeVideoId,
    setActiveVideoId,
    openQueueDrawer,
    removeFromQueue,
    activeUploadCount,
    recordScanResult,
    showDemo,
    setShowDemo,
    serverQueueLoading,
    queueCounts,
    doneSearch,
    setDoneSearch,
  } = useVideoUploadQueue();

  // Version picker: look back at an earlier submitted version of the selected item. Everything below then shows
  // that version as it was (video, caption, check, sentiment, notes), read-only.
  const [versionPick, setVersionPick] = useState<{ videoId: string; version: number } | null>(null);
  const latestVersion = latestVideo?.submissionId ? latestVideo.currentVersion ?? 0 : 0;
  const viewVersion =
    versionPick && versionPick.videoId === latestVideo?.id && versionPick.version < latestVersion ? versionPick.version : null;
  const versionQuery = useQuery({
    queryKey: ["submission-version", latestVideo?.submissionId, viewVersion],
    queryFn: () => submissionService.getVersion(latestVideo!.submissionId!, viewVersion!),
    enabled: Boolean(latestVideo?.submissionId && viewVersion),
    staleTime: 60_000,
  });
  const versionView = viewVersion ? versionQuery.data ?? null : null;
  const versionItem = useMemo(
    () => (latestVideo && versionView ? versionQueueItem(latestVideo, versionView) : null),
    [latestVideo, versionView]
  );
  const viewingOld = Boolean(versionItem);
  const activeVideo = versionItem ?? latestVideo;

  // Queue tabs. Reviewers start on what's waiting for them; creators on what's been sent back to them.
  const isReviewer = hasPermission("CONTENT_REVIEW_APPROVE");
  const [pickedTab, setPickedTab] = useState<QueueTab | null>(null);
  const openedItemTab = queue.find((i) => i.id === activeVideoId)?.queueTab;
  const queueTab: QueueTab = pickedTab ?? openedItemTab ?? (isReviewer ? "review" : "sent_back");
  const tabQueue = queue.filter((i) => (i.queueTab ?? "review") === queueTab);
  const QUEUE_TAB_LABELS: Record<QueueTab, string> = isReviewer
    ? { review: "Awaiting review", sent_back: "Changes requested", done: "Reviewed (last 30 days)" }
    : { review: "In review", sent_back: "Needs my changes", done: "Reviewed (last 30 days)" };
  // Spelled out on hover: what's in each tab and who it's waiting on.
  const QUEUE_TAB_HINTS: Record<QueueTab, string> = {
    review: isReviewer ? "Submitted or resubmitted content waiting for a reviewer's decision" : "Your content waiting for a reviewer's decision",
    sent_back: isReviewer ? "Sent back to the creator; waiting for them to fix and resubmit" : "A reviewer asked for changes; fix and resubmit",
    done: "Approved or rejected in the last 30 days. Older decisions are in the Content Portal.",
  };
  // Same stage colours as the dashboards and status pills.
  const QUEUE_TAB_STYLE: Record<QueueTab, { Icon: typeof Clock; tone: string }> = {
    review: { Icon: Hourglass, tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
    sent_back: { Icon: MessageSquareWarning, tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
    done: { Icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  };
  const QUEUE_EMPTY: Record<QueueTab, string> = {
    review: isReviewer ? "Nothing waiting for review." : "Nothing of yours is waiting for review.",
    sent_back: isReviewer ? "Nothing is waiting on creators." : "Nothing needs your changes.",
    done: doneSearch.trim() ? "Nothing decided in the last 30 days matches that search." : "Nothing decided in the last 30 days.",
  };
  const pickTab = (tab: QueueTab) => {
    setPickedTab(tab);
    const inTab = queue.filter((i) => (i.queueTab ?? "review") === tab);
    if (inTab.length && !inTab.some((i) => i.id === latestVideo?.id)) setActiveVideoId(inTab[0].id);
  };
  // Decided content is read-only here: late concerns go through "Reopen for changes".
  const isDecided = activeVideo?.queueTab === "done";
  // The player shows something from the open tab, or nothing: an approved video under an empty "To review" tab
  // would read as if it were waiting for review.
  const tabIds = tabQueue.map((i) => i.id).join(",");
  const selectedInTab = Boolean(latestVideo && tabQueue.some((i) => i.id === latestVideo.id));
  useEffect(() => {
    if (!selectedInTab && tabQueue.length) setActiveVideoId(tabQueue[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInTab, tabIds]);

  // Queue pages: side by side with the player, the queue shows as many posts as fit beside the player card and
  // pages the rest; stacked above it (narrower screens), a fixed number per page.
  const queueListRef = useRef<HTMLDivElement | null>(null);
  const playerCardRef = useRef<HTMLDivElement | null>(null);
  const [queuePageSize, setQueuePageSize] = useState(QUEUE_PAGE_SIZE_STACKED);
  const [queuePage, setQueuePage] = useState(0);
  useEffect(() => {
    const measure = () => {
      const list = queueListRef.current;
      const card = playerCardRef.current;
      if (!list || !card || !window.matchMedia("(min-width: 1280px)").matches) {
        setQueuePageSize(QUEUE_PAGE_SIZE_STACKED);
        return;
      }
      const items = Array.from(list.children) as HTMLElement[];
      // The tallest card shown, so a page never runs past the player even when some cards have extra rows.
      const itemHeight = Math.max(...items.map((el) => el.getBoundingClientRect().height), 120);
      const room = card.getBoundingClientRect().bottom - list.getBoundingClientRect().top - QUEUE_PAGER_HEIGHT;
      setQueuePageSize(Math.max(1, Math.floor((room + QUEUE_GAP) / (itemHeight + QUEUE_GAP))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    // Only the player card is watched: the list's own size changes with the page size, which would feed back.
    if (playerCardRef.current) observer.observe(playerCardRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selectedInTab, tabIds, activeVideo?.id]);
  // The estimate above can be off when something above the queue or the player shifts after it's measured, so
  // after every render: if the queue (with its page controls) still ends below the player card, show one fewer.
  const queueColumnRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const column = queueColumnRef.current;
    const card = playerCardRef.current;
    if (!column || !card || queuePageSize <= 1 || !window.matchMedia("(min-width: 1280px)").matches) return;
    if (column.getBoundingClientRect().bottom > card.getBoundingClientRect().bottom + 1) {
      setQueuePageSize((n) => Math.max(1, n - 1));
    }
  }, [queuePageSize, queuePage, queueTab, tabIds, activeVideo?.id, doneSearch]);
  const queuePages = Math.max(1, Math.ceil(tabQueue.length / queuePageSize));
  const shownPage = Math.min(queuePage, queuePages - 1);
  const pagedQueue = tabQueue.slice(shownPage * queuePageSize, (shownPage + 1) * queuePageSize);
  // Open on the page holding the selected post (after switching tabs, or when the page size changes).
  useEffect(() => {
    const at = tabQueue.findIndex((i) => i.id === latestVideo?.id);
    setQueuePage(at >= 0 ? Math.floor(at / queuePageSize) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueTab, queuePageSize, tabIds]);
  // Submitted videos are reviewed for real: comments are saved, the score is the server's check, and
  // reviewers make their decision here. Demo items keep their local, simulated behaviour.
  const submissionId = activeVideo?.submissionId ?? null;
  // Image, carousel and text posts: previewed as a post, with no player, timeline or transcript.
  const isStillPost = Boolean(submissionId && !activeVideo?.videoUrl);
  // A submitted post is screened for the platforms it was submitted for; demo videos offer the video platforms.
  const submittedPlatforms = (activeVideo?.platforms ?? []).filter((p): p is TargetPlatform =>
    SCREENER_PLATFORMS.includes(p as TargetPlatform)
  );
  const platformOptions: TargetPlatform[] = submissionId
    ? submittedPlatforms.length
      ? submittedPlatforms
      : [activeVideo!.platform]
    : ["TIKTOK", "YOUTUBE", "YOUTUBE_SHORTS", "LINKEDIN"];
  const queryClient = useQueryClient();
  const [isRetryingTranscript, setIsRetryingTranscript] = useState(false);

  const [platform, setPlatform] = useState<TargetPlatform>("TIKTOK");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("9:16");
  // "Original" shows the video in its own proportions (portrait, square or landscape); 9:16 / 16:9 preview how a
  // platform would crop it. A newly opened video starts in Original.
  const [nativeAspect, setNativeAspect] = useState<number | null>(null);
  const [useOriginal, setUseOriginal] = useState(true);
  const showOriginal = useOriginal && nativeAspect != null;
  const isPortrait = showOriginal ? nativeAspect! < 0.8 : aspectRatio === "9:16";

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("ZenaDrone Defense Swarm Logistics Field Demonstration");

  // Partial / Progressive Upload State
  const [partialUploadMode, setPartialUploadMode] = useState(false);
  const [partialUploadPercent, setPartialUploadPercent] = useState(100);

  // Platform specific metadata
  const [youtubeDescription, setYoutubeDescription] = useState(
    "Experience autonomous drone fleet operations with ZenaDrone 1000.\n\nLearn more at https://zenatech.com\n\nDisclaimer: " +
      MANDATORY_DOD_DISCLAIMER
  );
  const [tiktokCaption, setTiktokCaption] = useState(
    "Next-gen autonomous logistics in action! High-durability payload trials with #ZenaDrone. #DefenseTech #Drones #TechInnovation"
  );

  const [fullTranscript, setFullTranscript] = useState(
    SAMPLE_DEMO_SEGMENTS.map((s) => s.text).join(" ")
  );
  const [segments, setSegments] = useState<TimestampedSegment[]>(SAMPLE_DEMO_SEGMENTS);

  // Background Job Processing State
  const [activeJob, setActiveJob] = useState<VideoJob | null>(null);
  const [isJobExpanded, setIsJobExpanded] = useState(true);
  const pollingIntervalRef = useRef<any>(null);

  // Reviewer notes, kept per video. Sample notes belong to the built-in demo videos only; real
  // submissions start with none.
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, ReviewerComment[]>>({});
  const commentsKey = activeVideo?.id ?? "demo";
  const startingNotes = !activeVideo || activeVideo.isDemo ? SAMPLE_COMMENTS : NO_COMMENTS;
  const savedComments = useReviewComments(submissionId);
  const comments: ReviewerComment[] = submissionId
    ? savedComments.comments.filter((c) => !viewVersion || c.version_number === viewVersion).map((c) => ({
        id: c.id,
        author: c.author_name ?? "Someone",
        timestampSec: c.start_sec ?? null,
        endTimestampSec: c.end_sec ?? null,
        category: (c.category === "BRAND" ? "NOTE" : c.category) as CommentCategory,
        text: c.body,
        createdAt: `${c.from_reviewer ? "Reviewer" : "Uploader"} · ${c.version_number > 0 ? `v${c.version_number}` : "draft"} · ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}${c.resolved_at ? " · resolved" : ""}`,
        canDelete: c.can_delete && activeVideo?.queueTab !== "done" && !viewingOld,
        resolved: Boolean(c.resolved_at),
      }))
    : commentsByVideo[commentsKey] ?? startingNotes;
  const setComments = (update: (prev: ReviewerComment[]) => ReviewerComment[]) =>
    setCommentsByVideo((all) => ({ ...all, [commentsKey]: update(all[commentsKey] ?? startingNotes) }));

  const [commentInput, setCommentInput] = useState("");
  const [commentCategory, setCommentCategory] = useState<CommentCategory>("NOTE");
  const [commentTimeMode, setCommentTimeMode] = useState<"POINT" | "RANGE" | "NONE">("POINT");
  const [rangeStartSec, setRangeStartSec] = useState<number>(0);
  const [rangeEndSec, setRangeEndSec] = useState<number>(10);
  const [rangeStartInput, setRangeStartInput] = useState<string>("(0:00)");
  const [rangeEndInput, setRangeEndInput] = useState<string>("(0:10)");
  // No note is selected until someone clicks one, so the timeline doesn't show a range nobody chose.
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isDragging, setIsDragging] = useState(false);

  // Sync state with activeVideo from the upload queue
  useEffect(() => {
    if (activeVideo) {
      setVideoTitle(activeVideo.title);
      setPlatform(activeVideo.platform);
      // Real submissions bring their own caption into the caption panel (empty if they have none).
      if (activeVideo.submissionId || activeVideo.caption != null) {
        setTiktokCaption(activeVideo.caption ?? "");
        setYoutubeDescription(activeVideo.caption ?? "");
      }
      setAspectRatio(activeVideo.aspectRatio);
      setNativeAspect(null);
      setUseOriginal(true);
      if (activeVideo.segments && activeVideo.segments.length > 0) {
        setSegments(activeVideo.segments);
        setFullTranscript(activeVideo.segments.map((s) => s.text).join(" "));
      }
      setVideoUrl(activeVideo.videoUrl || null);
      if (!activeVideo.videoUrl) {
        // Demo items have no file: size the timeline to the script instead of a fixed minute.
        const scriptEnd = activeVideo.segments.reduce((max, s) => Math.max(max, s.endSec), 0);
        setDuration(scriptEnd || 60);
        setCurrentTime((t) => Math.min(t, scriptEnd || 60));
      }
      if (activeVideo.status === "UPLOADING" || activeVideo.status === "PROCESSING") {
        setPartialUploadMode(true);
        setPartialUploadPercent(activeVideo.progressPercent);
      } else {
        setPartialUploadMode(false);
        setPartialUploadPercent(100);
      }
    }
  }, [activeVideo?.id, activeVideo?.progressPercent]);

  // Submitted videos are transcribed in the background; load the script when it arrives.
  // Until then the caption is screened on its own.
  const transcriptKey = activeVideo?.submissionId
    ? `${activeVideo.id}:${activeVideo.transcriptStatus}:${activeVideo.segments.length}:${activeVideo.serverCheck?.checked_at ?? ""}`
    : null;
  useEffect(() => {
    if (!activeVideo?.submissionId) return;
    setSegments(activeVideo.segments);
    setFullTranscript(
      activeVideo.segments.length
        ? activeVideo.segments.map((s) => s.text).join(" ")
        : activeVideo.caption || activeVideo.title
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptKey]);

  const retryTranscript = async () => {
    if (!activeVideo?.submissionId || !activeVideo.videoFileId) return;
    setIsRetryingTranscript(true);
    try {
      await submissionService.transcribe(activeVideo.submissionId, activeVideo.videoFileId);
      await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    } catch (err) {
      toast.error(`Couldn't restart the transcript: ${(err as Error).message}`);
    } finally {
      setIsRetryingTranscript(false);
    }
  };

  const animationFrameRef = useRef<number | null>(null);
  // Set while a note's range is playing; playback pauses when it gets there.
  const rangeEndRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);


  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ComplianceCheckResponse | null>(null);
  // Only the newest scan may update the screen; an older, slower response is ignored.
  const scanSeq = useRef(0);
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);

  // Effective buffered progress percentage & maximum reviewable timestamp
  const effectiveUploadPercent = useMemo(() => {
    if (partialUploadMode) return partialUploadPercent;
    if (activeJob && activeJob.status === "PROCESSING") {
      return Math.max(25, activeJob.progress_percent);
    }
    return 100;
  }, [partialUploadMode, partialUploadPercent, activeJob]);

  const maxBufferedSec = useMemo(() => {
    return Math.max(12, Math.round((duration * effectiveUploadPercent) / 100));
  }, [duration, effectiveUploadPercent]);

  // Update default aspect ratio when platform changes
  const handlePlatformChange = (p: TargetPlatform) => {
    setPlatform(p);
    setUseOriginal(false);
    if (p === "TIKTOK" || p === "YOUTUBE_SHORTS") {
      setAspectRatio("9:16");
    } else {
      setAspectRatio("16:9");
    }
  };

  // Launch Background Job Pipeline
  const startBackgroundJob = async (fileObj?: File, customTitle?: string) => {
    const filename = fileObj ? fileObj.name : "demo_field_trial.mp4";
    const title = customTitle || videoTitle;

    setIsJobExpanded(true);
    setPartialUploadMode(true);
    setPartialUploadPercent(25);

    try {
      const job = await complianceService.startVideoJob({
        filename,
        video_title: title,
        platform,
        aspect_ratio: aspectRatio,
      });
      setActiveJob(job);
      toast.info(`Started upload & pipeline for ${filename}. Early chunks are reviewable immediately!`);

      // Begin polling job progress
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const updated = await complianceService.getVideoJob(job.job_id);
          setActiveJob(updated);
          setPartialUploadPercent(updated.progress_percent);

          if (updated.status === "COMPLETED") {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
            setPartialUploadMode(false);
            setPartialUploadPercent(100);
            toast.success("100% video upload complete! All pipeline stages finished.");
            handleRunScan();
          }
        } catch {
          // If polling endpoint fails, simulate client progression
          simulateLocalPipelineProgression();
        }
      }, 1200);
    } catch {
      simulateLocalPipelineProgression(filename, title);
    }
  };

  // Local fallback simulation if backend offline
  const simulateLocalPipelineProgression = (filename?: string, title?: string) => {
    const mockJob: VideoJob = {
      job_id: "local-" + crypto.randomUUID(),
      filename: filename || (videoFile ? videoFile.name : "demo_field_trial.mp4"),
      video_title: title || videoTitle,
      platform,
      aspect_ratio: aspectRatio,
      status: "PROCESSING",
      progress_percent: 25,
      current_stage_index: 0,
      current_stage: "UPLOADING",
      current_stage_label: "Streaming Initial Chunks & Checksum",
      stages: [
        { id: "UPLOADING", label: "File Codec & Checksum Verification", status: "IN_PROGRESS" },
        { id: "AUDIO_EXTRACTION", label: "Audio Stream Extraction & Normalization", status: "PENDING" },
        { id: "SPEECH_TRANSCRIBING", label: "Gemini Speech-to-Text Transcription", status: "PENDING" },
        { id: "DEFENSE_VISUAL_OCR", label: "Defense Visual & Insignia OCR Analysis", status: "PENDING" },
        { id: "COMPLIANCE_SCREENING", label: "Defense Thought Leadership Rulebook Check", status: "PENDING" },
      ],
      logs: [
        `[${new Date().toLocaleTimeString()}] Chunk 01 uploaded (12.4 MB). Ready for immediate playback review.`,
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActiveJob(mockJob);
    setPartialUploadMode(true);
    setPartialUploadPercent(25);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progressSteps = [25, 45, 70, 85, 100];
      const nextProgress = progressSteps[step] || 100;
      setPartialUploadPercent(nextProgress);

      setActiveJob((prev) => {
        if (!prev) return null;
        const stages = prev.stages.map((stg, i) => {
          if (i < step) return { ...stg, status: "COMPLETED" as const };
          if (i === step) return { ...stg, status: "IN_PROGRESS" as const };
          return { ...stg, status: "PENDING" as const };
        });

        const stageNames = [
          "Streaming Initial Chunks & Checksum",
          "Audio Stream Extraction & Normalization",
          "Gemini Speech-to-Text Transcription",
          "Defense Visual & Insignia OCR Analysis",
          "Defense Thought Leadership Rulebook Check",
        ];

        const logMessages = [
          `[${new Date().toLocaleTimeString()}] Chunk 02 uploaded. Buffer extended to ${Math.round((60 * nextProgress) / 100)}s.`,
          `[${new Date().toLocaleTimeString()}] Audio demuxed. 16kHz vocal track prepared.`,
          `[${new Date().toLocaleTimeString()}] Gemini Speech model transcribed 5 segments.`,
          `[${new Date().toLocaleTimeString()}] Keyframes scanned for restricted markings.`,
          `[${new Date().toLocaleTimeString()}] Full upload and rulebook screening complete!`,
        ];

        const isDone = step >= 4;
        if (isDone) {
          clearInterval(interval);
          setPartialUploadMode(false);
          setPartialUploadPercent(100);
          toast.success("100% video upload complete! All segments available.");
          handleRunScan();
        }

        return {
          ...prev,
          progress_percent: nextProgress,
          current_stage_index: step,
          current_stage_label: stageNames[step] || "Completed",
          status: isDone ? "COMPLETED" : "PROCESSING",
          stages,
          logs: [...prev.logs, logMessages[step] || "Step completed."],
        };
      });
    }, 1800);
  };

  // High-precision 60fps requestAnimationFrame loop for ultra-smooth playback & playhead glide
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    let lastVideoTime = videoRef.current ? videoRef.current.currentTime : 0;
    let lastClockTime = performance.now();

    const onFrame = (now: number) => {
      if (videoRef.current && videoUrl) {
        if (videoRef.current.paused) {
          setCurrentTime(videoRef.current.currentTime);
          setIsPlaying(false);
          return;
        }

        const currentVideoTime = videoRef.current.currentTime;
        // If the HTML5 video clock updated, re-anchor our clock reference
        if (currentVideoTime !== lastVideoTime) {
          lastVideoTime = currentVideoTime;
          lastClockTime = now;
        }

        // Interpolate smooth time between video clock updates (60fps)
        const currentRate = videoRef.current.playbackRate || playbackRate;
        const elapsedSinceAnchor = ((now - lastClockTime) / 1000) * currentRate;
        const smoothTime = Math.min(duration, lastVideoTime + elapsedSinceAnchor);
        setCurrentTime(smoothTime);

        // Guard against playing past unbuffered chunk in progressive mode
        if (effectiveUploadPercent < 100 && smoothTime >= maxBufferedSec) {
          videoRef.current.pause();
          setIsPlaying(false);
          toast.warning(
            `Reached end of buffered stream (${formatTime(maxBufferedSec)}). Remaining chunks are transferring.`
          );
          return;
        }

        if (videoRef.current.ended || smoothTime >= duration) {
          setIsPlaying(false);
          return;
        }

        if (rangeEndRef.current !== null && smoothTime >= rangeEndRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = rangeEndRef.current;
          setCurrentTime(rangeEndRef.current);
          rangeEndRef.current = null;
          setIsPlaying(false);
          return;
        }
      } else {
        // Simulated / Demo video playback (smooth 60fps)
        if (lastTimeRef.current !== null) {
          const deltaSec = ((now - lastTimeRef.current) / 1000) * playbackRate;
          setCurrentTime((prev) => {
            const next = prev + deltaSec;
            if (effectiveUploadPercent < 100 && next >= maxBufferedSec) {
              setIsPlaying(false);
              toast.warning(
                `Reached end of buffered stream (${formatTime(maxBufferedSec)}). Remaining chunks are transferring.`
              );
              return maxBufferedSec;
            }
            if (next >= duration) {
              setIsPlaying(false);
              return duration;
            }
            if (rangeEndRef.current !== null && next >= rangeEndRef.current) {
              const end = rangeEndRef.current;
              rangeEndRef.current = null;
              setIsPlaying(false);
              return end;
            }
            return next;
          });
        }
        lastTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(onFrame);
    };

    animationFrameRef.current = requestAnimationFrame(onFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, videoUrl, effectiveUploadPercent, maxBufferedSec, duration, playbackRate]);

  // Video time tracking fallback
  const handleTimeUpdate = () => {
    if (videoRef.current && !isPlaying) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration || 60);
      v.playbackRate = playbackRate;
      if (v.videoWidth && v.videoHeight) setNativeAspect(v.videoWidth / v.videoHeight);
    }
  };

  const togglePlay = () => {
    rangeEndRef.current = null;
    if (isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      // Loop back if at the end of duration or buffer
      if (currentTime >= duration || (effectiveUploadPercent < 100 && currentTime >= maxBufferedSec)) {
        seekTo(0);
      }
      if (videoRef.current && videoUrl) {
        videoRef.current.playbackRate = playbackRate;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        // The playback loop starts its clock on the next frame.
        lastTimeRef.current = null;
        setIsPlaying(true);
      }
    }
  };

  // Seek handler with partial upload guard & user feedback
  const seekTo = (sec: number) => {
    if (effectiveUploadPercent < 100 && sec > maxBufferedSec) {
      toast.warning(
        `Moment at ${formatTime(sec)} is still uploading in background (${effectiveUploadPercent}% complete). Seeking to latest buffered segment at ${formatTime(maxBufferedSec)}.`
      );
      sec = maxBufferedSec;
    }

    const clamped = Math.max(0, Math.min(sec, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  // Play just the part of the video a reviewer note covers, then pause.
  const playRange = (startSec: number, endSec: number) => {
    seekTo(startSec);
    rangeEndRef.current = Math.min(endSec, duration);
    if (videoRef.current && videoUrl) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      lastTimeRef.current = null;
      setIsPlaying(true);
    }
  };

  // Sub-frame stepper for precision compliance review
  const stepTime = (deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  };

  // Change playback speed
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    toast.info(`Playback speed set to ${rate}x`);
  };

  // Jump to specific timestamp and immediately pause playback at that exact frame
  const seekAndPause = (sec: number, label?: string) => {
    // 1. Immediately pause HTML5 video and 60fps rAF animation
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);

    // 2. Bound to buffered range if upload is in-progress
    if (effectiveUploadPercent < 100 && sec > maxBufferedSec) {
      toast.warning(
        `Moment at ${formatTime(sec)} is still uploading (${effectiveUploadPercent}% complete). Seeking to latest buffered segment at ${formatTime(maxBufferedSec)}.`
      );
      sec = maxBufferedSec;
    }

    const clamped = Math.max(0, Math.min(sec, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);

    toast.info(
      label
        ? `Jumped to ${formatTime(clamped)} and paused (${label})`
        : `Jumped to ${formatTime(clamped)} and paused`
    );
  };

  // Add a new comment
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) {
      toast.error("Please enter a comment or reviewer note.");
      return;
    }

    let startSec: number | null = null;
    let endSec: number | null = null;

    // Without a video there's no moment to pin a comment to.
    if (isStillPost) {
      startSec = null;
    } else if (commentTimeMode === "POINT") {
      startSec = Math.round(currentTime);
    } else if (commentTimeMode === "RANGE") {
      const s = Math.max(0, Math.min(rangeStartSec, duration));
      const end = Math.max(0, Math.min(rangeEndSec, duration));
      startSec = Math.min(s, end);
      endSec = Math.max(s, end);
    }

    if (submissionId) {
      savedComments.add.mutate(
        { body: commentInput.trim(), category: commentCategory, start_sec: startSec, end_sec: endSec },
        {
          onSuccess: () => {
            setCommentInput("");
            toast.success("Comment saved. The uploader sees it when you request changes.");
          },
        }
      );
      return;
    }

    const newComment: ReviewerComment = {
      id: "comm-" + Date.now(),
      author: authorName,
      timestampSec: startSec,
      endTimestampSec: endSec,
      category: commentCategory,
      text: commentInput.trim(),
      createdAt: "Just now",
    };

    setComments((prev) => [newComment, ...prev]);
    setCommentInput("");
    if (startSec !== null && endSec !== null) {
      toast.success(`Added range note: ${formatTime(startSec)} - ${formatTime(endSec)}`);
    } else if (startSec !== null) {
      toast.success(`Added note pinned at ${formatTime(startSec)}!`);
    } else {
      toast.success("Added general reviewer comment!");
    }
  };

  // Delete a comment
  const handleDeleteComment = (id: string) => {
    if (submissionId) {
      savedComments.remove.mutate(id);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    toast.info("Comment removed.");
  };

  // Run AI Compliance Scan. Automatic re-scans pass announce=false so they don't toast on every change.
  const handleRunScan = async (announce = true) => {
    if (!fullTranscript.trim()) {
      if (announce) toast.error("Please provide or transcribe video audio/narration first.");
      return;
    }
    const seq = ++scanSeq.current;
    setIsScanning(true);
    try {
      const additionalContext =
        platform === "YOUTUBE"
          ? `\n\nYouTube Description: ${youtubeDescription}`
          : `\n\nTikTok Caption: ${tiktokCaption}`;

      const res = await complianceService.checkCompliance({
        text: fullTranscript + additionalContext,
        video_title: videoTitle.trim() || undefined,
        content_type: `VIDEO_${platform}`,
      });
      if (seq !== scanSeq.current) return; // a newer scan has started since
      setScanResult(res);

      const updatedSegments = applySegmentRisk(segments, res.violations);
      setSegments(updatedSegments);

      // Keep the queue card's score in step with this check for the video in the player.
      if (activeVideo && fullTranscript === activeVideo.segments.map((s) => s.text).join(" ")) {
        recordScanResult(activeVideo.id, {
          score: res.score,
          violationCount: res.violations_count,
          segments: updatedSegments,
        });
      }

      if (!announce) {
        // automatic re-scan: the panel updates without a toast
      } else if (res.is_compliant) {
        toast.success(`No rulebook issues found in the text for ${platform}.`);
      } else if (res.traffic_light === "RED") {
        toast.error(`Stop! ${res.violations_count} critical red-line violation(s) flagged.`);
      } else {
        toast.warning(`Review required: ${res.violations_count} claims need clearance.`);
      }
    } catch (err: any) {
      if (seq === scanSeq.current) toast.error("Compliance scan failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      if (seq === scanSeq.current) setIsScanning(false);
    }
  };

  // Re-scan whenever what's being checked changes. Waits for the review queue first: scanning the built-in
  // sample before the real video loaded raced the real scan, so the score could differ between refreshes.
  // Debounced so typing in the caption doesn't send a check per keystroke.
  useEffect(() => {
    if (serverQueueLoading || !activeVideo) return;
    if (activeVideo.submissionId) {
      // The server checks title, caption and transcript with the submission's own rule sets: the same
      // score the Portal, detail page and reviewer see.
      scanSeq.current++;
      setIsScanning(false);
      setScanResult(activeVideo.serverCheck ?? null);
      return;
    }
    const timer = window.setTimeout(() => handleRunScan(false), 400);
    return () => window.clearTimeout(timer);
  }, [serverQueueLoading, activeVideo?.id, activeVideo?.serverCheck?.checked_at, platform, fullTranscript, tiktokCaption, youtubeDescription, videoTitle]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const parseTimeToSeconds = (str: string): number => {
    if (!str) return 0;
    const clean = str.trim().replace(/[()]/g, "");
    if (!clean) return 0;
    if (clean.includes(":")) {
      const parts = clean.split(":");
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseFloat(parts[1]) || 0;
        return Math.max(0, mins * 60 + secs);
      }
      if (parts.length === 3) {
        const hrs = parseInt(parts[0], 10) || 0;
        const mins = parseInt(parts[1], 10) || 0;
        const secs = parseFloat(parts[2]) || 0;
        return Math.max(0, hrs * 3600 + mins * 60 + secs);
      }
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  useEffect(() => {
    setRangeStartInput(`(${formatTime(rangeStartSec)})`);
  }, [rangeStartSec]);

  useEffect(() => {
    setRangeEndInput(`(${formatTime(rangeEndSec)})`);
  }, [rangeEndSec]);

  // Active segment
  const activeSegment = useMemo(() => {
    return segments.find((s) => currentTime >= s.startSec && currentTime <= s.endSec);
  }, [currentTime, segments]);

  useEffect(() => {
    setActiveCommentId(null);
    rangeEndRef.current = null;
  }, [activeVideo?.id]);

  // Active reviewer comment
  const activeComment = useMemo(() => {
    return comments.find((c) => c.id === activeCommentId) || null;
  }, [comments, activeCommentId]);

  // Required disclaimers come from the rulebook check: a rule asks for one when the content says
  // something that needs it (e.g. names a defense agency, shows a rendering, makes a forecast).
  const missingDisclaimers = useMemo(
    () => (scanResult?.violations ?? []).filter((v) => v.missing_disclaimers?.length),
    [scanResult]
  );
  const hasDoDDisclaimer = missingDisclaimers.length === 0;
  const disclaimerRules = missingDisclaimers.map((v) => v.rule_number).join(", ");

  const playerFrameRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen stretches the frame to the screen, so track it to letterbox the video at its native aspect ratio
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerFrameRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const platformName = PLATFORM_LABELS[platform];
  const playerThumbnail = useVideoThumbnail(videoUrl);

  // Script sections clipped to the real video length, so a short upload doesn't overflow the timeline.
  const timelineSegments = useMemo(
    () =>
      segments
        .filter((seg) => seg.startSec < duration)
        .map((seg) => ({ ...seg, endSec: Math.min(seg.endSec, duration) })),
    [segments, duration]
  );

  const queueItemDuration = (item: { segments: TimestampedSegment[] }) =>
    item.segments.reduce((max, s) => Math.max(max, s.endSec), 0);

  const riskCounts = useMemo(
    () => ({
      red: timelineSegments.filter((s) => s.risk === "RED").length,
      yellow: timelineSegments.filter((s) => s.risk === "YELLOW").length,
      green: timelineSegments.filter((s) => s.risk !== "RED" && s.risk !== "YELLOW").length,
    }),
    [timelineSegments]
  );

  const segmentForViolation = (v: ComplianceViolation) =>
    segments.find((s) => v.flagged_terms.some((term) => s.text.toLowerCase().includes(term.toLowerCase())));

  const scoreTone = (score: number) =>
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  const renderScore = (item: { complianceScore: number; violationCount: number; scoreStatus: string }) =>
    item.scoreStatus === "pending" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
      </span>
    ) : item.scoreStatus === "error" ? (
      <span className="text-xs text-muted-foreground">Score unavailable</span>
    ) : (
      <span className={`flex items-center gap-1.5 text-xs font-semibold ${scoreTone(item.complianceScore)}`}>
        {item.violationCount > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Score: {item.complianceScore}/100
        {item.violationCount > 0 && <span className="font-normal">· {item.violationCount} flag{item.violationCount === 1 ? "" : "s"}</span>}
      </span>
    );

  const resetDemo = () => {
    setVideoUrl(null);
    setDuration(60);
    setVideoFile(null);
    setActiveJob(null);
    setPartialUploadMode(false);
    setPartialUploadPercent(100);
    setSegments(SAMPLE_DEMO_SEGMENTS);
    setFullTranscript(SAMPLE_DEMO_SEGMENTS.map((s) => s.text).join(" "));
    setVideoTitle("ZenaDrone Defense Swarm Logistics Field Demonstration");
  };

  const copyClearanceReport = () => {
    if (!scanResult) return;
    const commentsSection =
      comments.length > 0
        ? `\n\nReviewer Comments & Sign-off Notes:\n` +
          comments
            .map((c) => {
              const timeStr =
                c.timestampSec !== null
                  ? c.endTimestampSec && c.endTimestampSec > c.timestampSec
                    ? ` @ ${formatTime(c.timestampSec)} - ${formatTime(c.endTimestampSec)}`
                    : ` @ ${formatTime(c.timestampSec)}`
                  : "";
              return `- [${c.category}${timeStr}] ${c.author}: ${c.text}`;
            })
            .join("\n")
        : "";

    const report = `ZenaTech Video Clearance Report\nPlatform: ${platform}\nAsset: ${videoTitle}\nScore: ${
      scanResult.score
    }/100\nStatus: ${scanResult.traffic_light}\nViolations: ${scanResult.violations_count}\nRequired disclaimers: ${
      hasDoDDisclaimer ? "None missing" : `Missing (${disclaimerRules})`
    }\nBuffered Review: ${effectiveUploadPercent}% so far\n\nViolations Flagged:\n${scanResult.violations
      .map((v) => `- [${v.severity}] ${v.rule_number} ${v.title}: ${v.explanation}`)
      .join("\n")}${commentsSection}`;

    navigator.clipboard.writeText(report);
    toast.success("Complete clearance report with reviewer notes copied!");
  };

  const toggleFullscreen = () => {
    const el = playerFrameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => toast.error("Fullscreen is not available in this browser."));
    }
  };

  const CATEGORY_LABELS: Record<CommentCategory, string> = {
    LEGAL: "Legal Counsel",
    EDITORIAL: "Editorial",
    COMPLIANCE: "Compliance Reviewer",
    NOTE: "General Note",
  };

  // Status pill for a queue card, in the Content Portal's colours.
  const queuePill = (item: (typeof queue)[number]) => {
    if (item.status === "UPLOADING" || item.status === "PROCESSING") return { label: `${item.progressPercent}% uploaded`, tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
    if (item.status === "QUEUED") return { label: "Queued", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" };
    if (item.isDemo || !item.submissionStatus) return { label: "Demo", tone: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300" };
    switch (item.submissionStatus) {
      case "IN_REVIEW":
        return { label: "In Review", tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" };
      case "CHANGES_REQUESTED":
        return { label: "Changes Requested", tone: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" };
      case "APPROVED":
        return { label: "Approved", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
      case "REJECTED":
        return { label: "Rejected", tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" };
      default:
        return { label: item.submissionStatus, tone: "bg-muted text-muted-foreground" };
    }
  };
  const waitingForMe = isReviewer ? queueCounts?.review ?? 0 : 0;

  return (
    <div data-canvas="plain" className="w-full max-w-[1600px] mx-auto space-y-5 pb-6 animate-in fade-in duration-300">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Content Screener</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review submitted content against the compliance rulebook: videos frame by frame, images and captions in full.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canUseDemo && !submissionId && (
            <>
              <Button variant="outline" size="sm" onClick={resetDemo} className="h-9 text-xs gap-1.5 font-semibold">
                <RotateCcw className="w-3.5 h-3.5" /> Reset demo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPartialUploadMode(true);
                  setPartialUploadPercent(50);
                  toast.info("Simulating Incomplete Upload: 50% buffered. Reviewing chunks 0:00 - 0:30 so far.");
                }}
                className="h-9 text-xs gap-1.5 font-semibold border-amber-500/40 text-amber-700 dark:text-amber-400"
              >
                <Radio className="w-3.5 h-3.5" /> Simulate partial upload
              </Button>
            </>
          )}
          {waitingForMe > 0 && queueTab !== "review" && (
            <button
              type="button"
              onClick={() => pickTab("review")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
            >
              <Clock className="w-4 h-4" /> {waitingForMe} waiting for your review
            </button>
          )}
          {/* Uploading is the creator's side of the app. */}
          {!isReviewer && (
            <Button onClick={() => navigate("/submissions/new")} className="h-10 rounded-lg px-4 gap-2 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white">
              <FilePlus2 className="w-4 h-4" /> Upload New Content
            </Button>
          )}
        </div>
      </header>

      {/* Queue tabs: one bar, like the Content Portal's status counts */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70" role="tablist" aria-label="Queue">
        {(["review", "sent_back", "done"] as QueueTab[]).map((tab) => {
          const active = queueTab === tab;
          const count = (queueCounts?.[tab] ?? 0) + (tab === "review" ? queue.filter((i) => i.isDemo).length : 0);
          const TabIcon = QUEUE_TAB_STYLE[tab].Icon;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              title={QUEUE_TAB_HINTS[tab]}
              onClick={() => pickTab(tab)}
              className={`flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                active ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${QUEUE_TAB_STYLE[tab].tone}`}>
                <TabIcon className="w-[18px] h-[18px]" />
              </span>
              <span className="min-w-0">
                <span className={`block text-2xl font-semibold leading-tight tabular-nums ${active ? "" : "text-foreground"}`}>{count}</span>
                <span className={`block truncate text-xs ${active ? "font-semibold" : ""}`}>{QUEUE_TAB_LABELS[tab]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        {/* Queue column */}
        <div ref={queueColumnRef} className="w-full space-y-3 xl:w-[320px] xl:shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              Queue <span className="font-normal text-muted-foreground">{tabQueue.length}</span>
              {activeUploadCount > 0 && (
                <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">{activeUploadCount} uploading</Badge>
              )}
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Queue options">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={openQueueDrawer} className="text-xs gap-2">
                  <Upload className="w-3.5 h-3.5" /> Open upload queue ({queue.length})
                </DropdownMenuItem>
                {canUseDemo && (
                  <>
                    <DropdownMenuItem onClick={() => setShowDemo(!showDemo)} className="text-xs gap-2">
                      <Film className="w-3.5 h-3.5" /> Show demo videos {showDemo && <Check className="w-3.5 h-3.5 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={activeJob?.status === "PROCESSING" || isScanning}
                      onClick={() => startBackgroundJob()}
                      className="text-xs gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {activeJob?.status === "PROCESSING" ? "Uploading & screening..." : "Trigger background job (demo)"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {queueTab === "done" && (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={doneSearch}
                  onChange={(e) => setDoneSearch(e.target.value)}
                  placeholder="Search title or reference..."
                  className="h-9 rounded-lg pl-9 text-xs"
                  aria-label="Search decided content"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Decided in the last 30 days, newest first. Older content is in the{" "}
                <button type="button" className="font-semibold text-blue-700 dark:text-blue-300 hover:underline" onClick={() => navigate("/submissions")}>
                  Content Portal
                </button>
                .
              </p>
            </div>
          )}

          {tabQueue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">{QUEUE_EMPTY[queueTab]}</div>
          ) : (
            <>
            <div ref={queueListRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
              {pagedQueue.map((item) => {
                const isSelected = item.id === (activeVideoId || activeVideo?.id);
                const isUploading = item.status === "UPLOADING" || item.status === "PROCESSING";
                const pill = queuePill(item);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setActiveVideoId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveVideoId(item.id);
                      }
                    }}
                    className={`group rounded-xl border bg-card p-3.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30 dark:border-blue-500/70 dark:bg-blue-500/10"
                        : "border-border/70 hover:border-blue-300 hover:shadow-sm dark:hover:border-blue-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${pill.tone}`}>{pill.label}</span>
                      {isSelected ? (
                        <span className="text-[10px] font-semibold tracking-wider text-blue-700 dark:text-blue-300">IN PLAYER</span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>

                    <div className="mt-3 flex gap-3">
                      <div className="w-20 shrink-0">
                        <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-900">
                          <QueueThumbnail item={item} fallbackDuration={queueItemDuration(item)} />
                          {isUploading && (
                            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
                              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${item.progressPercent}%` }} />
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {item.submissionId && !item.videoUrl
                            ? `${CONTENT_TYPE_LABELS[item.contentType ?? ""] ?? "Post"}${
                                (item.images?.length ?? 0) > 1 ? ` · ${item.images!.length} images` : ""
                              }`
                            : `Video · ${item.aspectRatio}`}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2" title={item.title}>
                          {item.title}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300">
                          <PlatformIcon platform={item.platform} className="w-3.5 h-3.5" />
                          {PLATFORM_LABELS[item.platform]}
                          {(item.platforms?.length ?? 0) > 1 && ` +${(item.platforms?.length ?? 1) - 1}`}
                        </p>
                        <p className="mt-0.5 truncate font-mono" title={item.filename}>
                          {item.referenceCode || item.filename}
                        </p>
                        {item.creatorName && <p className="truncate">By {item.creatorName}</p>}
                      </div>
                    </div>

                    {(item.dueAt || (item.queueTab === "review" && (item.currentVersion ?? 0) > 1)) && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {item.queueTab === "review" && (item.currentVersion ?? 0) > 1 && (
                          <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            v{item.currentVersion} · resubmitted
                          </span>
                        )}
                        <DueBadge dueAt={item.dueAt} kind={item.dueKind} />
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                      {isUploading ? (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          <Radio className="w-3 h-3 animate-pulse" /> Early review active
                        </span>
                      ) : (
                        renderScore(item)
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 shrink-0 text-muted-foreground"
                            title="Video options"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setActiveVideoId(item.id)} className="text-xs gap-2">
                            <Play className="w-3.5 h-3.5" /> Open in player
                          </DropdownMenuItem>
                          {item.submissionId ? (
                            <DropdownMenuItem onClick={() => navigate(`/submissions/${item.submissionId}`)} className="text-xs gap-2">
                              <ExternalLink className="w-3.5 h-3.5" /> Open submission {item.referenceCode}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onClick={() => removeFromQueue(item.id)} className="text-xs gap-2">
                              <Trash2 className="w-3.5 h-3.5" /> Remove from queue
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
            {queuePages > 1 && (
              <nav className="flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-label="Queue pages">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  disabled={shownPage === 0}
                  onClick={() => setQueuePage(shownPage - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <span className="tabular-nums">
                  {shownPage * queuePageSize + 1}–{Math.min(tabQueue.length, (shownPage + 1) * queuePageSize)} of {tabQueue.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  disabled={shownPage >= queuePages - 1}
                  onClick={() => setQueuePage(shownPage + 1)}
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </nav>
            )}
            </>
          )}
        </div>

        {/* Player and review: stacked on laptops, side by side when there's room */}
        <div className="@container/screen w-full min-w-0 flex-1 space-y-4 sm:space-y-5">
      {!selectedInTab ? (
        <Card className="py-10 px-6 border-dashed border-border/80 shadow-none items-center text-center gap-2">
          <p className="text-sm font-semibold text-foreground">{QUEUE_EMPTY[queueTab]}</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {queueTab === "review"
              ? `New and resubmitted content shows up here. ${QUEUE_TAB_LABELS.sent_back} and ${QUEUE_TAB_LABELS.done} hold everything else.`
              : "Pick another tab to open something in the player."}
          </p>
        </Card>
      ) : (
      <>
      {/* Target Platform & Viewport */}
      <Card className="py-0 border-border/70 shadow-xs">
        <div className="px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground mr-1">Target Platform{platformOptions.length > 1 ? "s" : ""}:</span>
            {platformOptions.map((p) => {
              const isActive = platform === p;
              // Video framing hints only mean something for a video.
              const ratio = isStillPost
                ? ""
                : p === "TIKTOK" || p === "YOUTUBE_SHORTS" ? " (9:16)" : p === "YOUTUBE" ? " (16:9)" : p === "LINKEDIN" ? " Video" : "";
              return (
                <Button
                  key={p}
                  size="sm"
                  variant="outline"
                  onClick={() => handlePlatformChange(p)}
                  className={`text-xs gap-1.5 font-semibold ${
                    isActive ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" : ""
                  }`}
                >
                  <PlatformIcon platform={p} className="w-3.5 h-3.5" />
                  {PLATFORM_LABELS[p]}
                  {ratio}
                </Button>
              );
            })}
          </div>

          {!isStillPost && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Viewport:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUseOriginal(true)}
              className={`text-xs font-semibold ${
                useOriginal ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15" : ""
              }`}
              title="The video's own proportions"
            >
              Original
            </Button>
            {(["9:16", "16:9"] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant="outline"
                onClick={() => {
                  setAspectRatio(r);
                  setUseOriginal(false);
                }}
                className={`text-xs font-semibold ${
                  !useOriginal && aspectRatio === r
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15"
                    : ""
                }`}
              >
                {r === "9:16" ? "9:16 Vertical" : "16:9 Landscape"}
              </Button>
            ))}
          </div>
          )}
        </div>
      </Card>

      {/* Partial upload notice */}
      {effectiveUploadPercent < 100 && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
            <p>
              <strong className="font-semibold">Upload in progress ({effectiveUploadPercent}% buffered).</strong>{" "}
              You can review 0:00 to {formatTime(maxBufferedSec)} now; the rest is still transferring.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPartialUploadMode(false);
              setPartialUploadPercent(100);
              toast.success("Switched to full asset view (100% available).");
            }}
            className="text-xs shrink-0 bg-background/80"
          >
            Clear Incomplete State
          </Button>
        </div>
      )}

      {/* Background job progress */}
      {activeJob && activeJob.status === "PROCESSING" && (
        <Card className="py-0 border-blue-500/40 bg-blue-500/5 dark:bg-blue-950/20 shadow-xs">
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-semibold text-foreground min-w-0">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <span className="truncate">Processing {activeVideo?.title || activeJob.filename}</span>
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                {activeJob.current_stage_label} · {activeJob.progress_percent}%
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsJobExpanded(!isJobExpanded)}
                  className="h-6 px-2 text-[11px] gap-1"
                >
                  {isJobExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {isJobExpanded ? "Hide steps" : "Show steps"}
                </Button>
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                style={{ width: `${activeJob.progress_percent}%` }}
              />
            </div>
            {isJobExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {activeJob.stages.map((stg, idx) => (
                  <div
                    key={stg.id}
                    className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 ${
                      stg.status === "COMPLETED"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : stg.status === "IN_PROGRESS"
                        ? "bg-blue-500/10 border-blue-500/40"
                        : "bg-card border-border/60 opacity-60"
                    }`}
                  >
                    {stg.status === "COMPLETED" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : stg.status === "IN_PROGRESS" ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0 mt-0.5" />
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">0{idx + 1}</span>
                    )}
                    <span className="font-medium leading-tight">{stg.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Scan result banner */}
      {scanResult && (
        <div
          className="px-4 py-3 rounded-xl border border-border/70 bg-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                scanResult.traffic_light === "RED"
                  ? "bg-red-50 text-red-600 dark:bg-red-500/10"
                  : scanResult.traffic_light === "YELLOW"
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
              }`}
            >
              {scanResult.traffic_light === "RED" ? (
                <XCircle className="w-5 h-5" />
              ) : scanResult.traffic_light === "YELLOW" ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-base font-bold ${
                    scanResult.traffic_light === "RED"
                      ? "text-red-700 dark:text-red-300"
                      : scanResult.traffic_light === "YELLOW"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {scanResult.is_compliant
                    ? `No issues found in the text for ${platformName}`
                    : `${scanResult.violations_count} Rule ${scanResult.violations_count === 1 ? "Violation" : "Violations"} Flagged for ${platformName}`}
                </span>
                <Badge
                  className={`rounded-full text-[11px] font-semibold ${
                    scanResult.traffic_light === "RED"
                      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                      : scanResult.traffic_light === "YELLOW"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  }`}
                >
                  {scanResult.traffic_light === "RED" ? "Critical" : scanResult.traffic_light === "YELLOW" ? "Needs review" : "Text clear"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  Compliance Health Score: <strong className="text-foreground">{scanResult.score} / 100</strong>
                  {scanResult.blocked && <strong className="ml-1.5 text-red-600 dark:text-red-400">· Blocked (critical rule)</strong>}
                </span>
                <span className="text-border">|</span>
                <span>
                  Required disclaimers:{" "}
                  <strong className={hasDoDDisclaimer ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {hasDoDDisclaimer ? "None missing" : `Missing (${disclaimerRules})`}
                  </strong>
                </span>
                <span className="text-border">|</span>
                <span>{comments.length} Reviewer Note(s)</span>
              </p>
              {activeVideo?.serverCheck && <CheckCoverage check={activeVideo.serverCheck} className="mt-1.5" />}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyClearanceReport} className="text-xs gap-1.5 font-semibold bg-background self-end md:self-auto shrink-0">
            <Download className="w-3.5 h-3.5" />
            Copy Clearance Report
          </Button>
        </div>
      )}

      {/* Player + review panel */}
      <div className="grid grid-cols-1 @5xl/screen:grid-cols-12 gap-4 sm:gap-5 items-start @5xl/screen:items-stretch">
        {/* Video Review Player (the queue pages to fit beside it) */}
        <Card
          ref={playerCardRef}
          className={`${isPortrait ? "@5xl/screen:col-span-5" : "@5xl/screen:col-span-7"} py-0 gap-0 border-border/70 shadow-xs overflow-hidden`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 flex items-center justify-center shrink-0">
                <PlatformIcon platform={platform} className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">{isStillPost ? "Post Preview" : "Video Review Player"}</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {isStillPost
                    ? `${CONTENT_TYPE_LABELS[activeVideo?.contentType ?? ""] ?? "Post"} · review its images and caption.`
                    : "Preview and review flagged content in context."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (videoUrl) {
                  window.open(videoUrl, "_blank", "noopener");
                } else if (activeVideo?.images?.length) {
                  window.open(activeVideo.images[0].url, "_blank", "noopener");
                } else if (isStillPost) {
                  toast.info("This post has no image or video to open.");
                } else {
                  toast.info("Upload or select a video file to open it in a new window.");
                }
              }}
              className="text-xs gap-1.5 font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in New Window
            </Button>
          </div>

          {isStillPost && activeVideo ? (
            <PostStillPreview key={activeVideo.id} item={activeVideo} />
          ) : (
          <div
            className={`mx-4 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-center ${isPortrait ? "px-3 py-4" : "p-3"}`}
          >
            <div
              ref={playerFrameRef}
              // Original: the video's own proportions, as wide as fits but no taller than about two-thirds of the screen.
              style={
                showOriginal && !isFullscreen
                  ? { aspectRatio: String(nativeAspect), width: `min(100%, calc(64vh * ${nativeAspect!.toFixed(4)}))` }
                  : undefined
              }
              className={`relative bg-zinc-950 text-white overflow-hidden group transition-all duration-300 ${
                isFullscreen
                  ? "w-screen h-screen bg-black"
                  : showOriginal
                  ? `max-w-full shadow-xl ${isPortrait ? "rounded-[22px] border-[5px] border-zinc-900" : "rounded-xl"}`
                  : isPortrait
                  ? // Sized by height so a tall video fills the stage without pushing the page down.
                    "h-[min(64vh,600px)] max-w-full aspect-[9/16] rounded-[22px] border-[5px] border-zinc-900 shadow-xl"
                  : "w-full aspect-video rounded-xl shadow-xl"
              }`}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={playerThumbnail.dataUrl ?? undefined}
                  className={`w-full h-full ${isFullscreen ? "object-contain" : "object-cover"}`}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div className="relative w-full h-full">
                  <DemoPoster variant={activeVideo?.posterVariant} className="absolute inset-0 w-full h-full" />
                  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 top-8 px-4 text-center">
                    <p className="text-sm font-bold text-white leading-tight drop-shadow">{videoTitle}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/75 mt-1">
                      {platformName} · {aspectRatio} demo preview
                    </p>
                  </div>
                </div>
              )}

              {isPortrait && (
                <div className="absolute top-2.5 left-2.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-zinc-300 font-mono pointer-events-none">
                  {platformName} safe zone
                </div>
              )}

              {activeSegment && (
                <div className="absolute bottom-14 inset-x-2.5 flex justify-center pointer-events-none">
                  <div
                    className={`px-2.5 py-1.5 rounded-lg backdrop-blur-md text-[11px] font-medium text-center shadow-lg max-w-full ${
                      activeSegment.risk === "RED"
                        ? "bg-red-950/90 text-red-100 border border-red-500/60"
                        : activeSegment.risk === "YELLOW"
                        ? "bg-amber-950/90 text-amber-100 border border-amber-500/60"
                        : "bg-black/75 text-zinc-100 border border-white/10"
                    }`}
                  >
                    "{activeSegment.text}"
                  </div>
                </div>
              )}

              {/* Compact controls */}
              <div className="absolute bottom-2 inset-x-2 rounded-xl bg-zinc-900/90 backdrop-blur-md border border-white/10 flex items-center gap-0.5 px-1.5 py-1 text-white">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={togglePlay}
                  className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                </Button>
                <span className="font-mono text-[11px] text-zinc-200 px-1 whitespace-nowrap">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <span className="flex-1" />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (videoRef.current) videoRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }}
                  className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white" title="Playback settings">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="top" className="w-44">
                    <DropdownMenuLabel className="text-[11px]">Playback speed</DropdownMenuLabel>
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <DropdownMenuItem key={rate} onClick={() => handlePlaybackRateChange(rate)} className="text-xs">
                        {rate}x {playbackRate === rate && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => stepTime(-1)} className="text-xs gap-2">
                      <SkipBack className="w-3.5 h-3.5" /> Back 1 second
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => stepTime(1)} className="text-xs gap-2">
                      <SkipForward className="w-3.5 h-3.5" /> Forward 1 second
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => seekTo(0)} className="text-xs gap-2">
                      <RotateCcw className="w-3.5 h-3.5" /> Restart
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={toggleFullscreen}
                  className="h-7 w-7 shrink-0 text-white hover:bg-white/15 hover:text-white"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* Flagged Moments timeline (videos only: it follows the video's time) */}
          {isStillPost ? (
            <div className="pb-4" />
          ) : (
          <div className="px-4 pt-4 pb-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Flagged Moments
                <span className="font-normal text-muted-foreground hidden sm:inline">
                  {activeVideo?.transcriptStatus === "COMPLETED" && segments.length === 0
                    ? "(no speech or on-screen text found, so only the title and caption were checked)"
                    : "(click the bar or press play to preview)"}
                </span>
                {effectiveUploadPercent < 100 && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">
                    Buffered to {formatTime(maxBufferedSec)}
                  </Badge>
                )}
              </span>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-red-600" /> Critical ({riskCounts.red})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-amber-500" /> Needs Review ({riskCounts.yellow})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Clear ({riskCounts.green})
                </span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 sm:gap-2.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => stepTime(-1)}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                title="Back 1 second"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                onClick={togglePlay}
                className="h-9 w-9 mt-[-2px] rounded-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => stepTime(1)}
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                title="Forward 1 second"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <span className="font-mono text-xs font-bold text-foreground min-w-[34px] text-right shrink-0 leading-8">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="relative h-8 select-none">
                  {/* Base track so any time without a script section still reads as part of the video */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-muted" />

                  {/* Full-length coloured sections, one per script segment */}
                  {timelineSegments.map((seg) => {
                    const isBuffered = seg.startSec <= maxBufferedSec;
                    const color = !isBuffered
                      ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(120,120,120,0.35)_3px,rgba(120,120,120,0.35)_6px)] bg-muted"
                      : seg.risk === "RED"
                      ? "bg-red-600"
                      : seg.risk === "YELLOW"
                      ? "bg-amber-500"
                      : "bg-emerald-500/80";
                    return (
                      <div
                        key={seg.id}
                        style={{
                          left: `${(seg.startSec / duration) * 100}%`,
                          width: `calc(${((seg.endSec - seg.startSec) / duration) * 100}% - 3px)`,
                        }}
                        className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full ${color}`}
                      />
                    );
                  })}

                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={currentTime}
                    onMouseDown={() => setIsDragging(true)}
                    onTouchStart={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchEnd={() => setIsDragging(false)}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    aria-label="Seek video"
                    title={activeSegment ? `${formatTime(activeSegment.startSec)} - ${formatTime(activeSegment.endSec)}: ${activeSegment.text}` : undefined}
                  />

                  {/* Playhead */}
                  <div
                    style={{ left: `${(Math.min(currentTime, duration) / duration) * 100}%`, willChange: "left" }}
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none z-20 ${isDragging ? "scale-110" : ""}`}
                  >
                    <div className="w-2.5 h-6 rounded-full bg-zinc-950 dark:bg-zinc-100 ring-2 ring-background shadow-md flex items-center justify-center">
                      <div className="w-0.5 h-3 rounded-full bg-zinc-500" />
                    </div>
                  </div>
                </div>

                {/* Selected note's range: click to play just that part */}
                {activeComment &&
                  activeComment.timestampSec !== null &&
                  activeComment.endTimestampSec &&
                  activeComment.endTimestampSec > activeComment.timestampSec &&
                  activeComment.timestampSec < duration && (() => {
                    const start = activeComment.timestampSec;
                    const end = Math.min(activeComment.endTimestampSec, duration);
                    const left = (start / duration) * 100;
                    const label = `${activeComment.author} note · ${formatTime(start)}–${formatTime(activeComment.endTimestampSec)}`;
                    return (
                      <div className="relative h-5">
                        <button
                          type="button"
                          onClick={() => playRange(start, end)}
                          style={{ left: `${left}%`, width: `${((end - start) / duration) * 100}%` }}
                          className="group absolute top-0 h-2 border-x-2 border-b-2 border-blue-500 rounded-b-sm hover:border-blue-600 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={`Play ${label}`}
                          aria-label={`Play ${label}`}
                        >
                          <span
                            className={`absolute top-2.5 inline-flex max-w-[min(260px,60vw)] items-center gap-1 whitespace-nowrap rounded bg-blue-500/10 px-1.5 py-px text-[10px] font-semibold text-blue-700 group-hover:bg-blue-500/20 dark:text-blue-300 ${
                              left > 60 ? "right-0" : "left-0"
                            }`}
                          >
                            <Play className="w-2.5 h-2.5 shrink-0 fill-current" /> <span className="truncate">{label}</span>
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                <div className="relative h-4 text-[10px] font-mono text-muted-foreground">
                  {timelineSegments
                    .filter((seg) => seg.startSec > 0 && seg.startSec / duration < 0.92)
                    .map((seg) => (
                      <span
                        key={seg.id}
                        style={{ left: `${(seg.startSec / duration) * 100}%` }}
                        className={`absolute -translate-x-1/2 hidden sm:block ${
                          seg.risk === "RED" ? "text-red-600 dark:text-red-400 font-semibold" : ""
                        }`}
                      >
                        {formatTime(seg.startSec)}
                      </span>
                    ))}
                </div>
              </div>
              <span className="font-mono text-xs text-muted-foreground min-w-[34px] shrink-0 leading-8">{formatTime(duration)}</span>
            </div>
          </div>
          )}

          {/* Timestamped reviewer comment bar */}
          {isDecided ? (
            <p className="border-t border-border/60 px-4 py-3.5 text-xs text-muted-foreground">
              This was decided, so its notes are read-only. To raise something new, reopen it for changes.
            </p>
          ) : (
          <form onSubmit={handleAddComment} className="border-t border-border/60 px-4 py-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={commentCategory} onValueChange={(val) => setCommentCategory(val as CommentCategory)}>
                <SelectTrigger className="h-8 w-[150px] text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as CommentCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!isStillPost && (
              <div className="flex flex-wrap items-center rounded-lg border border-border/70 p-0.5 bg-muted/40 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setCommentTimeMode("POINT")}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                    commentTimeMode === "POINT" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="w-3 h-3" /> Point ({formatTime(currentTime)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommentTimeMode("RANGE");
                    const cur = Math.round(currentTime);
                    setRangeStartSec(cur);
                    setRangeEndSec(Math.min(duration, cur + 5));
                  }}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                    commentTimeMode === "RANGE" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="w-3 h-3" /> Range ({formatTime(rangeStartSec)} - {formatTime(rangeEndSec)})
                </button>
                <button
                  type="button"
                  onClick={() => setCommentTimeMode("NONE")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    commentTimeMode === "NONE" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  No Time
                </button>
              </div>
              )}
            </div>

            {!isStillPost && commentTimeMode === "RANGE" && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground font-semibold">From</span>
                <input
                  type="text"
                  value={rangeStartInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRangeStartInput(val);
                    const parsed = parseTimeToSeconds(val);
                    if (!isNaN(parsed)) {
                      const clamped = Math.min(duration, Math.max(0, Math.round(parsed)));
                      setRangeStartSec(clamped);
                      if (rangeEndSec <= clamped) setRangeEndSec(Math.min(duration, clamped + 3));
                    }
                  }}
                  onBlur={() => setRangeStartInput(`(${formatTime(rangeStartSec)})`)}
                  className="w-16 h-7 px-1.5 rounded border border-border bg-background font-mono text-center font-semibold outline-none focus:border-foreground"
                  title="Start time (e.g. 0:06)"
                />
                <span className="text-muted-foreground font-semibold">to</span>
                <input
                  type="text"
                  value={rangeEndInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRangeEndInput(val);
                    const parsed = parseTimeToSeconds(val);
                    if (!isNaN(parsed)) setRangeEndSec(Math.min(duration, Math.max(0, Math.round(parsed))));
                  }}
                  onBlur={() => {
                    if (rangeEndSec <= rangeStartSec) {
                      const adjusted = Math.min(duration, rangeStartSec + 3);
                      setRangeEndSec(adjusted);
                      setRangeEndInput(`(${formatTime(adjusted)})`);
                    } else {
                      setRangeEndInput(`(${formatTime(rangeEndSec)})`);
                    }
                  }}
                  className="w-16 h-7 px-1.5 rounded border border-border bg-background font-mono text-center font-semibold outline-none focus:border-foreground"
                  title="End time (e.g. 0:15)"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const cur = Math.round(currentTime);
                    setRangeStartSec(cur);
                    if (rangeEndSec <= cur) setRangeEndSec(Math.min(duration, cur + 3));
                  }}
                  className="h-7 px-2 text-[11px]"
                >
                  Set start ({formatTime(currentTime)})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const cur = Math.round(currentTime);
                    if (cur <= rangeStartSec) {
                      setRangeStartSec(Math.max(0, cur - 3));
                      setRangeEndSec(cur);
                    } else {
                      setRangeEndSec(cur);
                    }
                  }}
                  className="h-7 px-2 text-[11px]"
                >
                  Set end ({formatTime(currentTime)})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => seekAndPause(rangeStartSec, "Range preview")}
                  className="h-7 px-2 text-[11px]"
                >
                  Preview range
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder={
                  commentTimeMode === "RANGE"
                    ? `Add reviewer note for ${formatTime(rangeStartSec)} - ${formatTime(rangeEndSec)}... (e.g. cut this section)`
                    : commentTimeMode === "POINT"
                    ? `Add reviewer note at ${formatTime(currentTime)}... (e.g. adjust disclaimer or cut)`
                    : "Add general reviewer note..."
                }
                className="h-9 text-sm flex-1 min-w-0"
              />
              <Button
                type="submit"
                className="h-9 text-xs font-semibold px-4 gap-1.5 shrink-0 self-end sm:self-auto bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="w-3.5 h-3.5" />
                Post Comment
              </Button>
            </div>
          </form>
          )}
        </Card>

        {/* Review panel */}
        <Card className={`${isPortrait ? "@5xl/screen:col-span-7" : "@5xl/screen:col-span-5"} py-0 gap-0 border-border/70 shadow-xs overflow-hidden @5xl/screen:h-0 @5xl/screen:min-h-full`}>
          {activeVideo?.submissionId && (
            <div className="px-4 pt-4">
              {latestVersion > 1 && (
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <label htmlFor="version-picker">Viewing</label>
                  <select
                    id="version-picker"
                    value={viewVersion ?? latestVersion}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setVersionPick(n >= latestVersion || !latestVideo ? null : { videoId: latestVideo.id, version: n });
                    }}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground"
                  >
                    {Array.from({ length: latestVersion }, (_, i) => latestVersion - i).map((n) => (
                      <option key={n} value={n}>
                        v{n}
                        {n === latestVersion ? " (latest)" : ""}
                      </option>
                    ))}
                  </select>
                  <span>of {latestVersion}</span>
                  {viewVersion && versionQuery.isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {viewVersion && versionQuery.data && !versionQuery.data.video && (
                    <span className="text-amber-700 dark:text-amber-300">That version had no video.</span>
                  )}
                </div>
              )}
              {viewingOld && versionView ? (
                <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 px-3 py-2 text-xs text-violet-950 dark:text-violet-100 space-y-1">
                  <p className="font-semibold">
                    Version {versionView.version_number}, as submitted {format(new Date(versionView.created_at), "MMM d, h:mm a")}
                    {versionView.created_by_name ? ` by ${versionView.created_by_name}` : ""}.
                  </p>
                  {versionView.review_job?.decision && (
                    <p>
                      {versionView.review_job.decision === "APPROVE" ? "Approved" : "Sent back for changes"}
                      {versionView.review_job.decided_by_name ? ` by ${versionView.review_job.decided_by_name}` : ""}
                      {versionView.review_job.decided_at ? ` on ${format(new Date(versionView.review_job.decided_at), "MMM d, h:mm a")}` : ""}
                      {versionView.review_job.decision_notes ? `: "${versionView.review_job.decision_notes}"` : "."}
                    </p>
                  )}
                  <p className="text-violet-950/80 dark:text-violet-100/80">
                    Its video, caption, compliance result, sentiment and notes are shown as they were. Nothing can be changed here.
                  </p>
                  <button type="button" onClick={() => setVersionPick(null)} className="font-semibold underline underline-offset-2">
                    Back to the latest version
                  </button>
                </div>
              ) : activeVideo.canReview ? (
                <ReviewDecisionPanel
                  compact
                  target={{
                    id: activeVideo.submissionId,
                    reference_code: activeVideo.referenceCode ?? "",
                    title: activeVideo.title,
                    status: activeVideo.submissionStatus ?? "IN_REVIEW",
                    current_version: activeVideo.currentVersion ?? 1,
                    platforms: activeVideo.platforms ?? [],
                    publish_at: activeVideo.publishAt,
                    due_at: activeVideo.dueAt,
                    due_kind: activeVideo.dueKind,
                    can_review: true,
                    can_approve: activeVideo.canApprove,
                    approver_names: activeVideo.approverNames,
                    open_critical_flags: activeVideo.openCriticalFlags,
                    manual_rules: activeVideo.serverCheck?.manual_review_rules,
                    score: activeVideo.serverCheck?.score ?? null,
                  }}
                />
              ) : (
                <p
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    activeVideo.submissionStatus === "APPROVED"
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
                      : activeVideo.submissionStatus === "CHANGES_REQUESTED"
                      ? "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100"
                      : "border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-100"
                  }`}
                >
                  {activeVideo.submissionStatus === "APPROVED"
                    ? "Approved. It's on the content calendar."
                    : activeVideo.submissionStatus === "CHANGES_REQUESTED"
                    ? "Changes requested. Waiting for the uploader to resubmit."
                    : "In review. Waiting for a reviewer (reviewers can't approve their own uploads)."}
                </p>
              )}
              {activeVideo.submissionStatus === "APPROVED" && !viewingOld && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <ApprovalActions
                    target={{
                      id: activeVideo.submissionId,
                      reference_code: activeVideo.referenceCode ?? "",
                      title: activeVideo.title,
                      status: "APPROVED",
                      current_version: activeVideo.currentVersion ?? 1,
                      publish_at: activeVideo.publishAt,
                      can_manage_approval: activeVideo.canManageApproval,
                    }}
                    isCreator={activeVideo.createdBy === user?.id}
                  />
                </div>
              )}
              {activeVideo.serverCheck?.transcript_pending && !viewingOld && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  The transcript is still being made; the score is re-checked with it automatically.
                </p>
              )}
            </div>
          )}
          <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">
                  {platform === "YOUTUBE" ? "Description & Disclaimers" : "Caption & Hashtags"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {hasDoDDisclaimer
                    ? `${platformName} ${platform === "YOUTUBE" ? "description" : "caption"} is screened against the rulebook, including required disclaimers.`
                    : `Needs: "${missingDisclaimers[0].missing_disclaimers![0]}"`}
                </p>
              </div>
            </div>
            <Badge
              className={`text-[10px] font-semibold shrink-0 ${
                hasDoDDisclaimer ? "rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
              }`}
            >
              {hasDoDDisclaimer ? "Disclaimers OK" : "Disclaimer Missing"}
            </Badge>
          </div>

          <div className="px-4 space-y-1.5">
            {platform === "YOUTUBE" ? (
              <>
                <Textarea
                  rows={3}
                  value={youtubeDescription}
                  onChange={(e) => setYoutubeDescription(e.target.value)}
                  readOnly={Boolean(submissionId)}
                  className="text-xs font-mono resize-y"
                  placeholder="Enter YouTube description..."
                />
                {!hasDoDDisclaimer && !submissionId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setYoutubeDescription((prev) => prev.trim() + "\n\n" + missingDisclaimers[0].missing_disclaimers![0]);
                      toast.success(`Added the disclaimer ${missingDisclaimers[0].rule_number} asks for.`);
                    }}
                    className="text-xs w-full text-amber-600 dark:text-amber-400 border-amber-500/40"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    Insert Required Disclaimer
                  </Button>
                )}
              </>
            ) : (
              <Textarea
                rows={2}
                value={tiktokCaption}
                onChange={(e) => setTiktokCaption(e.target.value)}
                readOnly={Boolean(submissionId)}
                className="text-xs font-mono resize-y"
                placeholder={submissionId ? "No caption was submitted." : "Enter caption and #hashtags..."}
              />
            )}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Characters: {(platform === "YOUTUBE" ? youtubeDescription : tiktokCaption).length} /{" "}
                {(CAPTION_LIMITS[platform] ?? 2200).toLocaleString()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(platform === "YOUTUBE" ? youtubeDescription : tiktokCaption);
                  toast.success("Copied!");
                }}
                className="text-[11px] h-6 px-2 gap-1"
              >
                <Copy className="w-3 h-3" /> Copy {platform === "YOUTUBE" ? "Description" : "Caption"}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="violations" className="@container px-4 pt-2 pb-4 gap-3 @5xl/screen:min-h-0 @5xl/screen:flex-1">
            <TabsList variant="line" className="h-auto min-h-10 w-full flex-wrap justify-start border-b border-border/70">
              {[
                { value: "comments", icon: MessageSquare, label: `Comments (${comments.length})` },
                { value: "violations", icon: AlertTriangle, label: `Flags (${scanResult?.violations_count || 0})` },
                { value: "sentiment", icon: Sparkles, label: "Sentiment Analysis" },
                { value: "script", icon: FileText, label: `Script (${segments.length})` },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex-none whitespace-nowrap px-2 text-xs font-semibold gap-1.5 data-active:text-blue-700 dark:data-active:text-blue-300 after:bg-blue-600"
                >
                  <Icon className="w-3.5 h-3.5 hidden sm:inline" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Sentiment (Gemini editorial read; submitted content only) */}
            <TabsContent value="sentiment" className="rounded-lg border border-border/70 p-3 max-h-[460px] overflow-y-auto @5xl/screen:max-h-none @5xl/screen:flex-1 @5xl/screen:min-h-0">
              {activeVideo?.submissionId ? (
                <SentimentPanel
                  key={`${activeVideo.submissionId}-${viewVersion ?? "latest"}`}
                  submissionId={activeVideo.submissionId}
                  version={viewVersion ?? undefined}
                  onSeek={seekTo}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Sentiment analysis runs on submitted content. Demo videos don't have one.</p>
              )}
            </TabsContent>

            {/* Flags */}
            <TabsContent value="violations" className="rounded-lg border border-border/70 @5xl/screen:flex @5xl/screen:flex-col @5xl/screen:flex-1 @5xl/screen:min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground">Violations Flagged & Compliant Fixes</span>
                <span className="text-[11px] text-muted-foreground">
                  {scanResult?.violations_count || 0} {scanResult?.violations_count === 1 ? "finding" : "findings"}
                </span>
              </div>
              <div className="p-2.5 space-y-2.5 max-h-[360px] overflow-y-auto @5xl/screen:max-h-none @5xl/screen:flex-1 @5xl/screen:min-h-0">
                {scanResult && <ScoreBreakdown check={scanResult} />}
                {scanResult && scanResult.violations.length > 0 ? (
                  scanResult.violations.map((v, i) => {
                    const seg = segmentForViolation(v);
                    const isRed = v.traffic_light === "RED";
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedViolation(v);
                          if (seg) seekAndPause(seg.startSec, `Violation: ${v.rule_number}`);
                        }}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex gap-3 ${
                          isRed ? "border-red-500/30 bg-red-500/5 hover:border-red-500/60" : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60"
                        } ${selectedViolation?.rule_number === v.rule_number ? "ring-2 ring-blue-500/50" : ""}`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white ${
                            isRed ? "bg-red-600" : "bg-amber-500"
                          }`}
                        >
                          {isRed ? <XCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={`rounded-full text-[10px] font-semibold ${isRed ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"}`}>
                              {isRed ? "Critical" : "Needs review"}
                            </Badge>
                            {seg && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {formatTime(seg.startSec)} - {formatTime(seg.endSec)}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{v.rule_number}</span>
                          </div>
                          <p className="font-semibold text-foreground">{v.title}</p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">{v.explanation}</p>
                          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-red-500/20 bg-background/70 px-2 py-1.5">
                            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Trigger word/phrase
                            </span>
                            <span className="text-[11px] font-mono text-foreground">
                              {v.flagged_terms.map((t) => `"${t}"`).join(", ")}
                            </span>
                          </div>
                          {v.remediation_guidance && (
                            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Suggested compliant fix
                              </span>
                              <p className="text-[11px] text-foreground/90">{v.remediation_guidance}</p>
                            </div>
                          )}
                          {activeVideo?.submissionId && v.rule_id && (
                            <FlagReviewControl
                              submissionId={activeVideo.submissionId}
                              ruleId={v.rule_id}
                              ruleNumber={v.rule_number}
                              currentVersion={activeVideo.currentVersion ?? 1}
                              canDismiss={Boolean(activeVideo.canReview) && !viewingOld}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    No compliance flags found. Ready for publication.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Comments */}
            <TabsContent value="comments" className="rounded-lg border border-border/70 @5xl/screen:flex @5xl/screen:flex-col @5xl/screen:flex-1 @5xl/screen:min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground">Reviewer Notes & Feedback</span>
                <span className="text-[11px] text-muted-foreground">{comments.length} notes</span>
              </div>
              <div className="p-2.5 space-y-2 max-h-[360px] overflow-y-auto @5xl/screen:max-h-none @5xl/screen:flex-1 @5xl/screen:min-h-0">
                {comments.length > 0 ? (
                  comments.map((c) => {
                    const isCommentActive = activeCommentId === c.id;
                    const startSec = c.timestampSec;
                    const endSec = c.endTimestampSec;
                    const hasRange = startSec !== null && typeof endSec === "number" && endSec > startSec;
                    const jump = () => {
                      setActiveCommentId(c.id);
                      if (startSec !== null) {
                        seekAndPause(
                          startSec,
                          hasRange ? `${c.author} range (${formatTime(startSec)} - ${formatTime(endSec!)})` : `${c.author} note`
                        );
                      }
                    };
                    return (
                      <div
                        key={c.id}
                        onClick={jump}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 cursor-pointer transition-all ${
                          isCommentActive
                            ? "border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/40"
                            : "border-border/70 bg-card hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="whitespace-nowrap">{c.author}</span>
                            <Badge
                              className={`text-[9px] uppercase font-bold py-0 ${
                                c.category === "LEGAL"
                                  ? "rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                                  : c.category === "EDITORIAL"
                                  ? "rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                  : c.category === "COMPLIANCE"
                                  ? "rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                  : "rounded-full bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
                              }`}
                            >
                              {c.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {startSec !== null && (
                              <Badge variant="outline" className="text-[10px] font-mono gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {hasRange ? `${formatTime(startSec)} - ${formatTime(endSec!)}` : formatTime(startSec)}
                              </Badge>
                            )}
                            {(c.canDelete ?? true) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteComment(c.id);
                                }}
                                className="text-muted-foreground hover:text-red-500 p-1"
                                title="Delete note"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-foreground/95 leading-relaxed">{c.text}</p>
                        <p className="text-[10px] text-muted-foreground">{c.createdAt}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No reviewer notes yet. Add one below.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Script */}
            <TabsContent value="script" className="rounded-lg border border-border/70 @5xl/screen:flex @5xl/screen:flex-col @5xl/screen:flex-1 @5xl/screen:min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground">Voiceover & Script</span>
                <span className="text-[11px] text-muted-foreground">
                  {effectiveUploadPercent < 100
                    ? `${segments.filter((s) => s.startSec <= maxBufferedSec).length} / ${segments.length} buffered`
                    : `${segments.length} segments`}
                </span>
              </div>
              <div className="p-2.5 space-y-2 max-h-[360px] overflow-y-auto @5xl/screen:max-h-none @5xl/screen:flex-1 @5xl/screen:min-h-0">
                {segments.length === 0 && activeVideo?.submissionId && (
                  <div className="flex flex-col items-center text-center gap-2 py-8 px-4 text-xs text-muted-foreground">
                    {isStillPost ? (
                      <>
                        <FileText className="w-5 h-5" />
                        <p className="font-semibold text-foreground">No video, so there's no script.</p>
                        <p>This post's title, caption and images are what's screened against the rulebook and sentiment analysis.</p>
                      </>
                    ) : activeVideo.transcriptStatus === "FAILED" ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <p className="font-semibold text-foreground">The transcript couldn't be generated.</p>
                        {activeVideo.transcriptError && <p className="max-w-sm break-words">{activeVideo.transcriptError}</p>}
                        <Button size="sm" variant="outline" className="text-xs gap-1.5 mt-1" disabled={isRetryingTranscript} onClick={retryTranscript}>
                          {isRetryingTranscript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Try again
                        </Button>
                      </>
                    ) : activeVideo.transcriptStatus === "COMPLETED" ? (
                      <>
                        <FileText className="w-5 h-5" />
                        <p className="font-semibold text-foreground">No speech or on-screen text found.</p>
                        <p>The title and caption are still screened against the rulebook.</p>
                        <p className="max-w-sm">
                          Videos read before on-screen text was added only have their speech. Read it again to check the text shown in the video too.
                        </p>
                        <Button size="sm" variant="outline" className="text-xs gap-1.5 mt-1" disabled={isRetryingTranscript} onClick={retryTranscript}>
                          {isRetryingTranscript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Read the video again
                        </Button>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <p className="font-semibold text-foreground">Reading the video...</p>
                        <p>Speech and on-screen text are being transcribed automatically. This usually takes under a minute.</p>
                      </>
                    )}
                  </div>
                )}
                {segments.map((seg) => {
                  const isBuffered = seg.startSec <= maxBufferedSec;
                  const isActive = currentTime >= seg.startSec && currentTime <= seg.endSec;
                  return (
                    <div
                      key={seg.id}
                      onClick={() => isBuffered && seekAndPause(seg.startSec, "Voiceover segment")}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        !isBuffered
                          ? "border-dashed border-border/50 bg-muted/20 opacity-50"
                          : isActive
                          ? "ring-1 ring-blue-500/50 border-blue-500/50 bg-blue-500/5"
                          : seg.risk === "RED"
                          ? "border-red-500/30 bg-red-500/5"
                          : seg.risk === "YELLOW"
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border/70 bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          {formatTime(seg.startSec)} - {formatTime(seg.endSec)}
                          {seg.onScreen && (
                            <span className="font-sans rounded bg-muted px-1 py-px text-[9px] uppercase tracking-wide">On screen</span>
                          )}
                        </span>
                        {!isBuffered ? (
                          <Badge variant="secondary" className="text-[9px] gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Uploading
                          </Badge>
                        ) : seg.risk === "RED" ? (
                          <Badge className="rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 text-[9px] font-semibold py-0">Critical</Badge>
                        ) : seg.risk === "YELLOW" ? (
                          <Badge className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[9px] font-semibold py-0">Needs review</Badge>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Clear
                          </span>
                        )}
                      </div>
                      <p className="text-foreground/90 leading-relaxed">{seg.text}</p>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

        </Card>
      </div>
      </>
      )}
        </div>
      </div>
    </div>
  );
}
