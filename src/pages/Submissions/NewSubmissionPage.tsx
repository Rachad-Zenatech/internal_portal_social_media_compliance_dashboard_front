import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addBusinessDays, format, isSameDay } from "date-fns";
import { toast } from "sonner";
import {
  Bold,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Clock,
  CloudUpload,
  Download,
  FilePlus2,
  FileText,
  GalleryHorizontalEnd,
  Globe,
  Globe2,
  Hash,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Megaphone,
  MessageSquareText,
  Redo2,
  Save,
  Send,
  Sparkles,
  Underline,
  Undo2,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field, MultiSelect } from "@/components/submissions/FormFields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import {
  ANALYSING_REFETCH_MS,
  MISSING_LABELS,
  SubmissionFileRow,
  audienceCodes,
  audienceNames,
  brandCodes,
  isAnalysing,
  SubmissionStatusBadge,
} from "@/components/submissions/submissionUi";
import ComplianceStep from "@/components/submissions/ComplianceStep";
import ComplianceView from "@/components/submissions/ComplianceView";
import DuplicateNotice from "@/components/submissions/DuplicateNotice";
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
import { CheckModelsUsed, CheckProgress, SavedCheckModels } from "@/components/submissions/CheckProgress";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import CaptionSuggester from "@/components/submissions/CaptionSuggester";
import CaptionSignalsBar from "@/components/submissions/CaptionSignalsBar";
import HashtagPicker from "@/components/submissions/HashtagPicker";
import PlatformCaptions from "@/components/submissions/PlatformCaptions";
import { useHashtagLibrary } from "@/hooks/useHashtagLibrary";
import RevisionWorkspace from "@/components/submissions/RevisionWorkspace";
import RevisionGuide from "@/components/submissions/RevisionGuide";
import { useReviewComments } from "@/hooks/useReview";
import CanvaImportDialog, { CANVA_PURPLE, CanvaMark, designFits } from "@/components/submissions/CanvaImportDialog";
import CanvaReimportBar from "@/components/submissions/CanvaReimportBar";
import ScriptStageCard from "@/components/script/ScriptStageCard";
import TopicTrend, { REC_BADGE, overallPostDecision } from "@/components/submissions/TopicTrend";
import { usePublicMood } from "@/hooks/usePublicMood";
import { useSentiment } from "@/hooks/useSentiment";
import { useScriptStage } from "@/hooks/useScript";
import { scriptService } from "@/services/scriptService";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { useGlobalProgress } from "@/lib/GlobalProgressContext";
import { POST_STEPS, isStepKey } from "@/lib/postSteps";
import PostStepNav, { StepFooter, StepGate } from "@/components/submissions/PostStepNav";
import type { PostStepKey, SubmissionSummary } from "@/types/submission";
import { safeHref, sanitizeCaptionHtml } from "@/lib/sanitizeHtml";
import { canvaService } from "@/services/canvaService";
import { submissionService } from "@/services/submissionService";
import { ApiError } from "@/services/helper";
import type {
  AccountOption,
  CheckAttempt,
  ContentType,
  DuplicateMatch,
  DuplicateReport,
  Submission,
  SubmissionFile,
  SubmissionFileKind,
  SubmissionStatus,
  SubmissionUpdate,
} from "@/types/submission";

// ---------------------------------------------------------------------------
// Static presentation config (allowed values themselves come from the API)
// ---------------------------------------------------------------------------

const CONTENT_TYPES: { value: ContentType; label: string; description: string; icon: LucideIcon }[] = [
  { value: "VIDEO", label: "Video", description: "TikTok, YouTube, LinkedIn, etc.", icon: Video },
  { value: "SOCIAL_POST", label: "Social Post", description: "Single image or text post", icon: MessageSquareText },
  { value: "CAROUSEL", label: "Carousel", description: "Multi-image post", icon: GalleryHorizontalEnd },
  { value: "IMAGE", label: "Image", description: "Single image asset", icon: ImageIcon },
  { value: "BLOG", label: "Blog / Article", description: "Long-form content", icon: FileText },
  { value: "AD", label: "Paid Ad", description: "Sponsored post or ad creative", icon: Megaphone },
];

const MAIN_UPLOAD: Record<ContentType, { main: string }> = {
  VIDEO: { main: "your video" },
  SOCIAL_POST: { main: "your image or video" },
  CAROUSEL: { main: "your carousel images" },
  IMAGE: { main: "your image" },
  BLOG: { main: "your article" },
  AD: { main: "your ad creative (image or video)" },
};
/** Types whose main file is required: there's nothing to review without it. */
const MAIN_REQUIRED: ContentType[] = ["VIDEO", "IMAGE", "CAROUSEL", "AD"];
/** Selected automatically with the Paid Ad type. */
const ADS_RULE_SET = "Paid Social Ads";

const ACCEPT_ALL = "video/*,image/*,.mp4,.mov,.avi,.webm,.mkv,.m4v,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.zip,.ppt,.pptx";
const VIDEO_RE = /\.(mp4|mov|avi|webm|mkv|m4v)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
const ARTICLE_RE = /\.(pdf|docx?|md|txt)$/i;
const DOC_RE = /\.(pdf|docx?|md|txt|xlsx?|csv|zip|pptx?)$/i;
/** Files the check can read as a script. */
const SCRIPT_RE = /\.(pdf|docx?|md|txt)$/i;
const ACCEPT_SCRIPT = ".pdf,.docx,.doc,.txt,.md";

/**
 * Decide what each dropped file is: the main content asset, an extra image, or a supporting document.
 * Returns null with a reason for files this submission can't take.
 */
function classifyFile(
  file: File,
  type: ContentType,
  mainTaken: boolean,
  scriptTaken = false
): { kind: SubmissionFileKind } | { error: string } {
  const name = file.name;
  const isVideo = VIDEO_RE.test(name) || file.type.startsWith("video/");
  const isImage = IMAGE_RE.test(name) || file.type.startsWith("image/");
  const isMainType =
    (type === "VIDEO" && isVideo) ||
    ((type === "IMAGE" || type === "CAROUSEL") && isImage) ||
    ((type === "SOCIAL_POST" || type === "AD") && (isVideo || isImage)) ||
    (type === "BLOG" && ARTICLE_RE.test(name));

  if (isMainType && (type === "CAROUSEL" || !mainTaken)) return { kind: "MAIN" };
  if (isVideo) {
    return {
      error: mainTaken && (type === "VIDEO" || type === "SOCIAL_POST" || type === "AD")
        ? "only one video per submission. Remove the current one to replace it."
        : "videos can only be added to Video, Social Post or Paid Ad submissions.",
    };
  }
  if (isImage) return { kind: "IMAGE" };
  // A document named as a script is the script (read into the compliance check); other documents are supporting.
  if (SCRIPT_RE.test(name) && !scriptTaken && /script/i.test(name)) return { kind: "SCRIPT" };
  if (DOC_RE.test(name)) return { kind: "SUPPORTING" };
  return { error: "this file type isn't supported." };
}

const CHAR_LIMITS: Partial<Record<string, number>> = {
  X: 280,
  TIKTOK: 2200,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
  YOUTUBE: 5000,
  YOUTUBE_SHORTS: 5000,
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/** "Need approval by" falls at this time of day unless the creator picks another. */
const DEFAULT_APPROVAL_TIME = "17:00";

/** Every half hour of the day as "HH:mm", plus the current value if it's off the half hour (an older draft). */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const timeOptions = (current: string) => (HALF_HOURS.includes(current) ? HALF_HOURS : [...HALF_HOURS, current].sort());

/** "17:00" -> "5:00 PM". */
function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** A copy of the date at the given "HH:mm" time. */
function withTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(Number.isFinite(h) ? h : 17, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** What each required detail is called when it is missing. */
const MISSING_LABEL: Record<string, string> = {
  title: "Title",
  brand_code: "Brand",
  account_id: "Account to post on",
  audience: "Audience",
  region: "Region",
  platforms: "Platform",
  script: "Script",
  main_file: "Image or video",
  caption: "Caption",
  rule_sets: "Rule set",
};

/** The editor shows one of the five steps at a time (?step=). */
const STEP_NUMBER: Record<PostStepKey, number> = { details: 1, compliance: 2, sentiment: 3, mood: 4, send: 5 };
const STEP_TITLE: Record<PostStepKey, string> = {
  details: "Post details",
  compliance: "Compliance rules",
  sentiment: "Sentiment analysis",
  mood: "Public mood",
  send: "Send for review",
};
const STEP_DESCRIPTION: Record<PostStepKey, string> = {
  details: "",
  compliance: "Check your post against the rulebook yourself. Edit and check again as often as you like.",
  sentiment: "How the tone and messaging may land with your audience. Edit and run it again as often as you like.",
  mood: "",
  send: "Pick your reviewers and send it. Once it is sent the post is locked.",
};

function Section({ title, description, children, id }: { step?: number; title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <Card id={id} className="py-0 gap-0 rounded-2xl border-border/70 shadow-xs scroll-mt-4">
      <div className="px-5 sm:px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold tracking-tight text-foreground leading-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="px-5 sm:px-6 pb-6">{children}</div>
    </Card>
  );
}

function SummaryRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[18px_118px_1fr] items-start gap-2 py-2 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
      <span className="text-muted-foreground text-xs mt-0.5">{label}</span>
      <div className="text-foreground min-w-0 break-words">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewSubmissionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeId = searchParams.get("id");
  const { setActiveVideoId } = useVideoUploadQueue();
  const { addJob } = useGlobalProgress();
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 60_000 });
  const options = optionsQuery.data;

  // Submission identity and server state
  const [submissionId, setSubmissionId] = useState<string | null>(routeId);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionStatus>("DRAFT");
  const [loadingExisting, setLoadingExisting] = useState(Boolean(routeId));
  const idRef = useRef<string | null>(routeId);

  // My posts opens a post on the step it was left on (?step=compliance): once the draft has loaded, scroll to it.
  const stepParam = searchParams.get("step");
  useEffect(() => {
    if (!isStepKey(stepParam) || loadingExisting) return;
    const timer = window.setTimeout(() => document.getElementById(`step-${stepParam}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => window.clearTimeout(timer);
  }, [stepParam, loadingExisting]);

  // Form fields
  // A new post can start on a type picked elsewhere (e.g. the dashboard's quick-create buttons: ?type=CAROUSEL).
  const [contentType, setContentType] = useState<ContentType>(() => {
    const picked = searchParams.get("type");
    return CONTENT_TYPES.find((c) => c.value === picked)?.value ?? "VIDEO";
  });
  const [title, setTitle] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  // Publishing accounts, primary first.
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [audiences, setAudiences] = useState<string[]>([]);
  const [region, setRegion] = useState("Global");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [publishDate, setPublishDate] = useState<Date | undefined>(undefined);
  // When the creator needs it approved by (required): the reviewer's deadline once it's sent. The time defaults
  // to 5:00 PM and applies to whichever date they pick.
  const [approvalBy, setApprovalBy] = useState<Date | undefined>(undefined);
  const [approvalTime, setApprovalTime] = useState(DEFAULT_APPROVAL_TIME);
  const [caption, setCaption] = useState("");
  // Platforms with their own caption; the rest post the main one.
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [ruleSets, setRuleSets] = useState<string[]>(["Public Company Disclosure"]);
  const [reviewers, setReviewers] = useState<string[]>(["Marketing Review", "Compliance Review"]);
  // The people it's sent to for review; none picked sends it to every reviewer on the brand.
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);

  // Files, checks and save status
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [uploading, setUploading] = useState<{ key: string; name: string; kind: SubmissionFileKind }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replacingMain, setReplacingMain] = useState(false);
  const [dueAt, setDueAt] = useState<string | null>(null);
  // After changes are requested, only the content, caption and comments are shown until asked for the rest.
  const [showAllDetails, setShowAllDetails] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editCounter, setEditCounter] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const [isDraggingMain, setIsDraggingMain] = useState(false);
  const [canvaOpen, setCanvaOpen] = useState(false);
  const [suggesterOpen, setSuggesterOpen] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  // The creator's own pre-send checks: the post as last saved (it carries the rulebook check), whether one is running,
  // and the edit count when it last ran, to say when it's out of date.
  const [checkedSub, setCheckedSub] = useState<Submission | null>(null);
  // Sent for review: every step can be looked at, nothing can be changed or run again.
  const [readOnly, setReadOnly] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAtEdit, setCheckedAtEdit] = useState<number | null>(null);
  // The models each AI step tried during the latest check (as they happen), when it started, and how long it took.
  const [checkAttempts, setCheckAttempts] = useState<CheckAttempt[]>([]);
  const [checkStartedAt, setCheckStartedAt] = useState(0);
  const [lastCheckMs, setLastCheckMs] = useState<number | null>(null);
  // The earlier post this one repeats on another date, while the creator is asked whether to send it again.
  const [repostAsk, setRepostAsk] = useState<DuplicateMatch | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scriptInputRef = useRef<HTMLInputElement | null>(null);
  const saveChain = useRef<Promise<string | null>>(Promise.resolve(null));
  // A draft this page just created; the URL update that follows mustn't reload it over the user's typing.
  const createdIdRef = useRef<string | null>(null);
  const pendingCaptionHtml = useRef<string | null>(null);
  const captionSectionRef = useRef<HTMLDivElement | null>(null);
  const checkSectionRef = useRef<HTMLDivElement | null>(null);

  const markEdited = () => {
    setEditCounter((n) => n + 1);
    setSaveState("dirty");
    setServerMissing([]);
  };

  const accounts = useMemo(() => options?.accounts ?? [], [options]);

  const reviewersQuery = useQuery({
    queryKey: ["submission-reviewers", [...brands].sort()],
    queryFn: () => submissionService.reviewers(brands),
    staleTime: 60_000,
  });
  const reviewerOptions = useMemo(() => reviewersQuery.data ?? [], [reviewersQuery.data]);
  // Picks who review none of the post's brands (they changed) are dropped, once those brands' reviewers are known.
  const pickedReviewers = reviewersQuery.data
    ? reviewerIds.filter((id) => reviewerOptions.some((r) => r.id === id))
    : reviewerIds;
  const selectedAccounts = useMemo(
    () => accountIds.map((id) => accounts.find((a) => a.id === id)).filter((a): a is AccountOption => Boolean(a)),
    [accounts, accountIds]
  );
  const brandAccounts = useMemo(
    () => accounts.filter((a) => brands.length === 0 || !a.brand_code || brands.includes(a.brand_code)),
    [accounts, brands]
  );
  // Selected platforms nobody is posting to yet (a YouTube account covers YouTube Shorts too).
  const platformsWithoutAccount = platforms.filter(
    (p) => !selectedAccounts.some((a) => a.platform === p || (a.platform === "YOUTUBE" && p === "YOUTUBE_SHORTS"))
  );
  const brandName = brands.map((c) => options?.brands.find((b) => b.code === c)?.name ?? c).join(", ") || undefined;
  const audienceLabel = audienceNames(audiences, options?.audiences) ?? undefined;
  const mainUpload = MAIN_UPLOAD[contentType];
  const ContentTypeIcon = CONTENT_TYPES.find((c) => c.value === contentType)!.icon;

  // Video posts start with the script: it's reviewed and approved before the video can be added. Drafts from before
  // the script stage (required: false) work as they always did.
  const scriptStage = useScriptStage(submissionId, contentType === "VIDEO");
  const scriptFirst = contentType === "VIDEO" && (!submissionId || scriptStage.data?.required !== false);
  const videoLocked = scriptFirst && scriptStage.data?.status !== "APPROVED";
  // Posts already sent for approval with the same content and caption, looked up again after every save and upload.
  const duplicatesQuery = useQuery({
    queryKey: ["submission-duplicates", submissionId, checkedSub?.updated_at, files.map((f) => f.id).join(",")],
    queryFn: () => submissionService.duplicates(submissionId!),
    enabled: !!submissionId && !videoLocked,
    staleTime: 0,
  });
  const duplicates = duplicatesQuery.data;
  // A video post with no script yet: the script goes in first, other files after.
  const needScriptFirst = videoLocked && !files.some((f) => f.kind === "SCRIPT");
  const refreshScript = () => queryClient.invalidateQueries({ queryKey: ["script"] });

  // Live public mood & news sentiment for the post's topics.
  const { mood, isLoading: moodLoading, refresh: refreshMood, dismissTopic } = usePublicMood(submissionId, Boolean(submissionId));
  // The same query the sentiment panel uses, so the step bar knows when it has run (no extra request).
  const { analysis: sentimentAnalysis } = useSentiment(submissionId);

  // After a reviewer asks for changes: their decision (who, when, their note) and the comments still open.
  const inRevision = status === "CHANGES_REQUESTED";
  const { data: revisionHistory } = useQuery({
    queryKey: ["submission-history", submissionId],
    queryFn: () => submissionService.history(submissionId!),
    enabled: Boolean(submissionId) && inRevision,
    staleTime: 0,
  });
  const sentBack = useMemo(
    () =>
      (revisionHistory?.review_jobs ?? [])
        .filter((j) => j.decision === "REQUEST_CHANGES" && j.decided_at)
        .sort((a, b) => new Date(b.decided_at!).getTime() - new Date(a.decided_at!).getTime())[0] ?? null,
    [revisionHistory]
  );
  const { comments: reviewComments } = useReviewComments(inRevision ? submissionId : null);
  const moodDecision = overallPostDecision(mood);

  // Scripts are read in the background; refresh their status until they're done so the creator sees it.
  const readingScript = files.some(
    (f) => (f.kind === "SCRIPT" || f.kind === "MAIN") && SCRIPT_RE.test(f.original_name) && (f.doc_text_status == null || f.doc_text_status === "PROCESSING")
  );
  useEffect(() => {
    if (!readingScript || !submissionId) return;
    const t = window.setInterval(async () => {
      try {
        const fresh = await submissionService.get(submissionId);
        const byId = new Map(fresh.files.map((f) => [f.id, f]));
        // Only the read status changes; everything else the creator is editing stays as it is.
        setFiles((prev) =>
          prev.map((f) => {
            const n = byId.get(f.id);
            return n ? { ...f, doc_text: n.doc_text, doc_text_status: n.doc_text_status, doc_text_error: n.doc_text_error } : f;
          })
        );
      } catch {
        // Try again on the next tick.
      }
    }, 4000);
    return () => window.clearInterval(t);
  }, [readingScript, submissionId]);

  // ----- Load an existing draft (S08 resume) -----
  const applyServer = useCallback((s: Submission) => {
    setSubmissionId(s.id);
    idRef.current = s.id;
    setReferenceCode(s.reference_code);
    setStatus(s.status);
    setDueAt(s.due_kind === "REVISION" ? s.due_at ?? null : null);
    setFiles(s.files);
    setCheckedSub(s);
  }, []);

  useEffect(() => {
    if (!routeId || routeId === createdIdRef.current) return;
    setLoadingExisting(true);
    let cancelled = false;
    submissionService
      .get(routeId)
      .then((s) => {
        if (cancelled) return;
        if (!s.can_edit && s.status !== "IN_REVIEW") {
          toast.info(`${s.reference_code} is ${s.status.replace("_", " ").toLowerCase()}. Withdraw it to make changes.`);
          navigate(`/submissions/${s.id}`, { replace: true });
          return;
        }
        applyServer(s);
        setReadOnly(!s.can_edit);
        setSentAt(s.submitted_at ?? null);
        setContentType(s.content_type);
        setTitle(s.title === "Untitled submission" ? "" : s.title);
        setBrands(brandCodes(s));
        setAccountIds(s.account_ids?.length ? s.account_ids : s.account_id ? [s.account_id] : []);
        setAudiences(audienceCodes(s));
        setRegion(s.region || "Global");
        setPlatforms(s.platforms);
        setPublishDate(s.publish_at ? new Date(s.publish_at) : undefined);
        setApprovalBy(s.approval_needed_by ? new Date(s.approval_needed_by) : undefined);
        setApprovalTime(s.approval_needed_by ? format(new Date(s.approval_needed_by), "HH:mm") : DEFAULT_APPROVAL_TIME);
        setRuleSets(s.rule_sets.length ? s.rule_sets : ["Public Company Disclosure"]);
        setReviewers(s.reviewer_route.length ? s.reviewer_route : ["Marketing Review", "Compliance Review"]);
        setReviewerIds(s.reviewer_ids ?? []);
        // The editor mounts after the loading state clears; the effect below fills it in.
        pendingCaptionHtml.current = s.caption_html || "";
        setCaption(s.caption_text || "");
        setPlatformCaptions(s.platform_captions ?? {});
        setSavedAt(new Date(s.updated_at));
        setSaveState("saved");
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof ApiError && err.status === 404 ? "That submission doesn't exist." : `Couldn't load the draft: ${err.message}`);
        navigate("/submissions/new", { replace: true });
      })
      .finally(() => !cancelled && setLoadingExisting(false));
    return () => {
      cancelled = true;
    };
    // Load once per id; saving never changes routeId afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  useEffect(() => {
    if (!loadingExisting && pendingCaptionHtml.current !== null && editorRef.current) {
      // Captions saved before the server sanitized them may hold unsafe HTML; never load it as-is.
      editorRef.current.innerHTML = sanitizeCaptionHtml(pendingCaptionHtml.current);
      pendingCaptionHtml.current = null;
    }
  }, [loadingExisting]);

  // ----- Saving (S01, S02-S04, S06, S08) -----
  const buildPayload = (): SubmissionUpdate => {
    const clear: SubmissionUpdate["clear_fields"] = [];
    if (!publishDate) clear.push("publish_at");
    if (!approvalBy) clear.push("approval_needed_by");
    if (!accountIds.length) clear.push("account_id");
    if (brands.length === 0) clear.push("brand_code");
    if (audiences.length === 0) clear.push("audience");
    return {
      title: title.trim() || "Untitled submission",
      content_type: contentType,
      ...(brands.length ? { brand_codes: brands } : {}),
      ...(audiences.length ? { audiences } : {}),
      ...(region ? { region } : {}),
      platforms,
      ...(accountIds.length ? { account_ids: accountIds } : {}),
      ...(publishDate ? { publish_at: publishDate.toISOString() } : {}),
      ...(approvalBy ? { approval_needed_by: approvalBy.toISOString() } : {}),
      caption_html: editorRef.current?.innerHTML || "",
      caption_text: editorRef.current?.innerText.trim() || "",
      // Only for platforms it still goes to; a platform that was taken off loses its caption.
      platform_captions: Object.fromEntries(Object.entries(platformCaptions).filter(([p]) => platforms.includes(p))),
      rule_sets: ruleSets,
      reviewer_route: reviewers,
      reviewer_ids: pickedReviewers,
      clear_fields: clear,
    };
  };

  /** Create the draft if needed, then save the current fields. Calls are queued so they never overlap. */
  const save = (opts: { force?: boolean } = {}): Promise<string | null> => {
    if (readOnly) return Promise.resolve(idRef.current);
    const payload = buildPayload();
    const hasAnything = Boolean(title.trim() || payload.caption_text || brands.length || platforms.length || accountIds.length);
    saveChain.current = saveChain.current
      .catch(() => null)
      .then(async () => {
        if (!idRef.current && !hasAnything && !opts.force) return null;
        setSaveState("saving");
        try {
          if (!idRef.current) {
            const created = await submissionService.create(payload.title || "Untitled submission", contentType);
            idRef.current = created.id;
            createdIdRef.current = created.id;
            setSubmissionId(created.id);
            setReferenceCode(created.reference_code);
            setSearchParams({ id: created.id }, { replace: true });
          }
          const updated = await submissionService.update(idRef.current!, payload);
          applyServer(updated);
          setSavedAt(new Date());
          setSaveState("saved");
          return updated.id;
        } catch (err) {
          setSaveState("error");
          throw err;
        }
      });
    return saveChain.current;
  };

  // Autosave 1.5 s after the last edit.
  useEffect(() => {
    if (editCounter === 0 || readOnly) return;
    const t = window.setTimeout(() => {
      save().catch((err: Error) => toast.error(`Couldn't save the draft: ${err.message}`));
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCounter]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === "dirty" || saveState === "saving" || uploading.length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState, uploading.length]);

  const saveNow = async () => {
    try {
      const id = await save({ force: true });
      toast.success(`Draft saved${referenceCode || id ? ` · ${referenceCode ?? ""}` : ""}. You can come back to it from My Submissions.`);
    } catch (err) {
      toast.error(`Couldn't save the draft: ${(err as Error).message}`);
    }
  };

  // ----- Routing suggestions, applied when the user changes brand/audience/account -----
  const suggestRouting = (next: { brands?: string[]; audiences?: string[]; accounts?: AccountOption[] }) => {
    const rules = new Set(["Public Company Disclosure"]);
    const route = new Set(["Marketing Review", "Compliance Review"]);
    // The software brands are ZenaTech businesses, so ZenaTech's general rules apply to them too.
    if (next.brands?.some((b) => b === "ZENATECH" || b === "SOFTWARE")) rules.add("ZenaTech General");
    if (next.brands?.includes("ZENADRONE") || next.audiences?.includes("DEFENSE")) {
      rules.add("ZenaDrone Defense");
      route.add("Legal Review");
    }
    if (next.audiences?.includes("INVESTORS")) route.add("Investor Relations Review");
    if (next.brands?.includes("CEO_THOUGHT_LEADERSHIP") || next.accounts?.some((a) => a.is_ceo)) {
      rules.add("Shaun CEO Thought Leadership");
      route.add("Legal Review");
      route.add("Executive Review");
    }
    setRuleSets((prev) => Array.from(new Set([...prev, ...rules])));
    setReviewers((prev) => Array.from(new Set([...prev, ...route])));
  };

  const onBrandsChange = (codes: string[]) => {
    setBrands(codes);
    // Drop accounts that belong to a brand that's no longer picked.
    const kept = selectedAccounts.filter((a) => codes.length === 0 || !a.brand_code || codes.includes(a.brand_code));
    if (kept.length !== selectedAccounts.length) setAccountIds(kept.map((a) => a.id));
    suggestRouting({ brands: codes, audiences, accounts: kept });
    markEdited();
  };

  const onAccountsChange = (ids: string[]) => {
    const next = ids.map((id) => accounts.find((a) => a.id === id)).filter((a): a is AccountOption => Boolean(a));
    setAccountIds(ids);
    // Each new account's platform gets selected too, unless it's already covered (YouTube covers Shorts).
    const added = next.filter((a) => !accountIds.includes(a.id));
    const missing = added
      .map((a) => a.platform)
      .filter((p, i, all) => all.indexOf(p) === i && !platforms.includes(p) && !(p === "YOUTUBE" && platforms.includes("YOUTUBE_SHORTS")));
    if (missing.length) setPlatforms((prev) => [...prev, ...missing]);
    suggestRouting({ brands, audiences, accounts: next });
    markEdited();
  };

  const onAudiencesChange = (values: string[]) => {
    setAudiences(values);
    suggestRouting({ brands, audiences: values, accounts: selectedAccounts });
    markEdited();
  };

  // ----- Files (S05, S07) -----
  const uploadFiles = async (list: File[], opts: { replacingMain?: boolean; asScript?: boolean } = {}) => {
    if (list.length === 0) return;

    let mainTaken = !opts.replacingMain && files.some((f) => f.kind === "MAIN");
    // One script per submission: a new one replaces the old (the server keeps the old with its version).
    let scriptTaken = !opts.asScript && files.some((f) => f.kind === "SCRIPT");
    const batch: { file: File; kind: SubmissionFileKind; key: string }[] = [];
    for (const file of list) {
      const result: { kind: SubmissionFileKind } | { error: string } = opts.asScript
        ? SCRIPT_RE.test(file.name)
          ? { kind: "SCRIPT" }
          : { error: "a script has to be a PDF, Word (.docx), .txt or .md file." }
        : classifyFile(file, contentType, mainTaken, scriptTaken);
      if ("error" in result) {
        toast.error(`${file.name}: ${result.error}`);
        continue;
      }
      if (result.kind === "MAIN" && videoLocked) {
        toast.error(`${file.name}: get the script approved first, then add the video.`);
        continue;
      }
      if (result.kind === "MAIN") mainTaken = true;
      if (result.kind === "SCRIPT") scriptTaken = true;
      batch.push({ file, kind: result.kind, key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}` });
    }
    if (batch.length === 0) return;

    let id: string | null;
    try {
      id = await save({ force: true });
    } catch (err) {
      toast.error(`Couldn't create the draft: ${(err as Error).message}`);
      return;
    }
    if (!id) return;
    const firstMain = batch.find((b) => b.kind === "MAIN");
    if (firstMain && !title.trim()) {
      setTitle(firstMain.file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
      markEdited();
    }

    setUploading((prev) => [...prev, ...batch.map(({ file, key, kind }) => ({ key, name: file.name, kind }))]);
    for (const { file, key, kind } of batch) {
      try {
        const uploadPromise = submissionService.uploadFile(id, kind, file);
        addJob(file.name, uploadPromise, {
          description: kind === "SCRIPT" ? "Uploading & reading script..." : "Uploading content file...",
          type: kind === "SCRIPT" ? "document" : "upload",
          submissionId: id,
          link_url: `/submissions/new?id=${id}`,
        });
        const saved = await uploadPromise;
        // The server keeps one script: the new one replaces any earlier one.
        setFiles((prev) => [...(kind === "SCRIPT" ? prev.filter((f) => f.kind !== "SCRIPT") : prev), saved]);
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploading((prev) => prev.filter((u) => u.key !== key));
      }
    }
    setServerMissing([]);
    if (batch.some((b) => b.kind === "SCRIPT")) refreshScript();
  };

  const removeFile = async (file: SubmissionFile) => {
    if (!submissionId) return;
    setRemovingId(file.id);
    try {
      await submissionService.removeFile(submissionId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast.success(`Removed ${file.original_name}`);
      if (file.kind === "SCRIPT") refreshScript();
    } catch (err) {
      toast.error(`Couldn't remove the file: ${(err as Error).message}`);
    } finally {
      setRemovingId(null);
    }
  };

  /** Swap the main file for a new one (the revision workspace's "Replace video"). */
  const replaceMain = async (file: File) => {
    if (!submissionId) return;
    if ("error" in classifyFile(file, contentType, false)) {
      toast.error(`${file.name}: this isn't ${MAIN_UPLOAD[contentType].main}.`);
      return;
    }
    const old = files.filter((f) => f.kind === "MAIN");
    setReplacingMain(true);
    try {
      for (const f of old) await submissionService.removeFile(submissionId, f.id);
      setFiles((prev) => prev.filter((f) => f.kind !== "MAIN"));
      await uploadFiles([file], { replacingMain: true });
      toast.success(`Replaced with ${file.name}. The new version is checked when you resubmit.`);
    } catch (err) {
      toast.error(`Couldn't replace the file: ${(err as Error).message}`);
    } finally {
      setReplacingMain(false);
    }
  };

  // ----- Canva -----
  const canvaMain = files.find((f) => f.kind === "MAIN" && f.source === "CANVA");
  const canvaFits = designFits("IMAGE", contentType) || designFits("VIDEO", contentType);

  const onCanvaImported = (s: Submission) => {
    applyServer(s);
    // The server names an untitled draft after the design; keep that rather than autosaving over it.
    if (!title.trim() && s.title && s.title !== "Untitled submission") setTitle(s.title);
    setServerMissing([]);
  };

  /** Bring in the linked design's latest revision; after changes were requested, optionally resubmit too. */
  const reimportCanva = async (andResubmit: boolean) => {
    setReimporting(true);
    try {
      const id = await save({ force: true });
      if (!id) return;
      const reimportPromise = canvaService.reimport(id);
      addJob("Reimport from Canva", reimportPromise, {
        description: "Importing latest Canva revision...",
        type: "upload",
        submissionId: id,
        link_url: `/submissions/new?id=${id}`,
      });
      const s = await reimportPromise;
      applyServer(s);
      const f = s.files.find((x) => x.kind === "MAIN" && x.source === "CANVA");
      toast.success(`Reimported revision ${f?.canva_revision ?? ""} from Canva.`);
      if (andResubmit) await submit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) toast.info((err as Error).message);
      else toast.error(`Couldn't reimport from Canva: ${(err as Error).message}`);
    } finally {
      setReimporting(false);
    }
  };

  // "Need approval by": the picked day at the chosen time, never after the publish time.
  const atApprovalTime = (d: Date) => withTime(d, approvalTime);
  const pickApproval = (d: Date | undefined) => {
    setApprovalBy(d && publishDate && d > publishDate ? new Date(publishDate) : d);
    markEdited();
  };

  const mainFiles = files.filter((f) => f.kind === "MAIN");
  const clientMissing = {
    title: !title.trim(),
    brand_code: brands.length === 0,
    account_id: accountIds.length === 0,
    audience: audiences.length === 0,
    region: !region,
    platforms: platforms.length === 0,
    // A video post starts with its script: it has to be uploaded (and then approved) before anything else is sent.
    script: scriptFirst && !scriptStage.isLoading && !scriptStage.data?.file_name && !(scriptStage.data?.versions.length ?? 0),
    // While the script is still being approved, the video and the caption aren't asked for yet.
    main_file: !videoLocked && MAIN_REQUIRED.includes(contentType) && mainFiles.length === 0,
    // Every post needs a caption: the score and the sentiment analysis read it first.
    caption: !videoLocked && !caption.trim(),
    rule_sets: ruleSets.length === 0,
    reviewer_ids: pickedReviewers.length === 0,
    approval_needed_by: !approvalBy,
    // Checked on submit (and by the server); comparing to "now" during render isn't stable.
    publish_at: false,
  };
  const isMissing = (field: keyof typeof clientMissing) =>
    showErrors && (clientMissing[field] || serverMissing.includes(field));
  const errorFor = (field: keyof typeof clientMissing, text = "Required") => (isMissing(field) ? text : false);

  const resubmitting = status === "CHANGES_REQUESTED";
  const showDetails = !resubmitting || showAllDetails;

  // ---- The five steps: one at a time (?step=), and the later ones wait until the details are filled in ----
  const stepView: PostStepKey = isStepKey(stepParam) && submissionId ? stepParam : "details";
  const onDetails = stepView === "details";
  const SENDING_FIELDS = ["reviewer_ids", "approval_needed_by", "publish_at"];
  // What the post still needs before its compliance check, sentiment analysis and public mood can be run.
  const detailsMissing = (Object.entries(clientMissing) as [keyof typeof clientMissing, boolean][])
    .filter(([key, missing]) => missing && !SENDING_FIELDS.includes(key))
    .map(([key]) => MISSING_LABEL[key] ?? key);
  const detailsComplete = detailsMissing.length === 0;
  // A video's script is approved first; until then its own flow handles the later steps.
  const gated = !onDetails && !videoLocked && !detailsComplete;
  const toolView = (step: PostStepKey) => stepView === step && !gated;
  const goToStep = (step: PostStepKey) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("step", step);
      return next;
    });

  const [continuing, setContinuing] = useState(false);
  const [dupChecked, setDupChecked] = useState<{ report: DuplicateReport; edit: number } | null>(null);
  const [repostTarget, setRepostTarget] = useState<PostStepKey | null>(null);

  /** Moving on from the details: every required field is in, the draft is saved, and the post is not a duplicate. */
  const leaveDetails = async (target: PostStepKey) => {
    setShowErrors(true);
    if (!detailsComplete) {
      toast.error(`Fill in the required fields first: ${detailsMissing.join(", ")}.`);
      window.setTimeout(() => document.querySelector(".border-red-500")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      return;
    }
    setContinuing(true);
    try {
      const id = await save({ force: true });
      if (!videoLocked) {
        const report = await submissionService.duplicates(id!);
        setDupChecked({ report, edit: editCounter });
        if (report.blocked) {
          toast.error(`This is a duplicate of ${report.blocking?.reference_code}. Change the post details first.`);
          return;
        }
        if (report.repost) {
          // The same post went out before, on another date: ask before going on.
          setRepostTarget(target);
          setRepostAsk(report.repost);
          return;
        }
      }
      goToStep(target);
    } catch (err) {
      toast.error(`Couldn't check the post: ${(err as Error).message}`);
    } finally {
      setContinuing(false);
    }
  };
  // The compliance step has its own two columns (score and findings, your post marked up), so it takes the whole width.
  const wideCompliance = (toolView("compliance") || toolView("sentiment")) && !videoLocked;
  const backToCaption = () => {
    goToStep("details");
    window.setTimeout(() => captionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };
  const openStep = (target: PostStepKey) =>
    onDetails && target !== "details" && !readOnly ? void leaveDetails(target) : goToStep(target);

  /** Save, then screen the post against the rulebook without sending it; the creator can edit and run it again. */
  const runComplianceCheck = async () => {
    if (!detailsComplete && !videoLocked) {
      toast.error(`Fill in the required fields before running the check: ${detailsMissing.join(", ")}.`);
      setShowErrors(true);
      goToStep("details");
      return;
    }
    if (!title.trim() && !caption.trim()) {
      toast.error("Add a title or caption before running the compliance check.");
      return;
    }
    const started = Date.now();
    setChecking(true);
    setCheckAttempts([]);
    setCheckStartedAt(started);
    try {
      const id = await save({ force: true });
      // Each model call is shown as it happens (fallbacks too); the old result stays hidden until the new one is in.
      const updated = await submissionService.runCheckStream(id!, (a) =>
        setCheckAttempts((prev) => (prev.some((p) => p.id === a.id) ? prev.map((p) => (p.id === a.id ? a : p)) : [...prev, a]))
      );
      setCheckedSub(updated);
      setCheckedAtEdit(editCounter);
      setLastCheckMs(Date.now() - started);
    } catch (err) {
      toast.error(`Couldn't run the compliance check: ${(err as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  // Check back while the check is still reading the post (videos, documents), so the score shows up when it's ready.
  const checkAnalysing = isAnalysing(checkedSub?.latest_check);
  useEffect(() => {
    if (!checkAnalysing || !submissionId) return;
    const t = window.setInterval(async () => {
      try {
        setCheckedSub(await submissionService.get(submissionId));
      } catch {
        // Try again on the next tick.
      }
    }, ANALYSING_REFETCH_MS);
    return () => window.clearInterval(t);
  }, [checkAnalysing, submissionId]);

  const hasCheck = Boolean(checkedSub?.latest_check);
  // Edited since the last check (a check loaded with the draft counts as current until something changes).
  const checkStale = hasCheck && editCounter !== (checkedAtEdit ?? 0);
  // In a revision, a check counts only once it has run again after the reviewer sent the post back.
  const sentBackAt = sentBack?.decided_at ? new Date(sentBack.decided_at).getTime() : null;
  const ranSinceSentBack = (at?: string | null) =>
    Boolean(at && revisionHistory) && (sentBackAt == null || new Date(at!).getTime() > sentBackAt);
  const recheck = {
    compliance: hasCheck && !checkStale && ranSinceSentBack(checkedSub?.latest_check?.checked_at),
    sentiment: sentimentAnalysis?.status === "COMPLETED" && ranSinceSentBack(sentimentAnalysis.completed_at),
    mood: Boolean(mood),
  };
  const changesMade = editCounter > 0 || recheck.compliance;

  const submit = async (confirmRepost = false) => {
    const missingNow = Object.entries(clientMissing).filter(([, v]) => v).map(([k]) => k);
    const badDates: string[] = [];
    if (publishDate && publishDate.getTime() < Date.now()) badDates.push("publish_at");
    if (approvalBy && approvalBy.getTime() < Date.now()) badDates.push("approval_needed_by");
    if (badDates.length) {
      missingNow.push(...badDates.filter((d) => !missingNow.includes(d)));
      setServerMissing(badDates);
    }
    if (!missingNow.length && approvalBy && publishDate && approvalBy > publishDate) {
      setServerMissing(["approval_needed_by"]);
      setShowErrors(true);
      toast.error("The \"need approval by\" date has to be on or before the publish date.");
      return;
    }
    if (missingNow.length) {
      setShowErrors(true);
      setShowAllDetails(true);
      toast.error(`Please add: ${missingNow.map((m) => MISSING_LABELS[m] || m).join(", ")}.`);
      return;
    }
    if (videoLocked) {
      // Until the script is approved, "Send for Review" sends the script; the video and caption come after.
      const stage = scriptStage.data;
      if (stage && !stage.can_submit) {
        toast.info(
          stage.status === "IN_REVIEW"
            ? "Your script is already with a reviewer. Add the video once it's approved."
            : "Your script isn't ready to send yet. Open it from the script card above."
        );
        return;
      }
      if (stage && (!stage.precheck || stage.precheck_stale)) {
        toast.info(
          stage.precheck
            ? "The script changed since its compliance check. Check it again on the script card, then send it."
            : "Check the script's compliance on the script card first, then send it."
        );
        return;
      }
      setSubmitting(true);
      try {
        const id = await save({ force: true });
        const next = await scriptService.submit(id!, confirmRepost);
        queryClient.setQueryData(["script", id], next);
        queryClient.invalidateQueries({ queryKey: ["script-queue"] });
        queryClient.invalidateQueries({ queryKey: ["submission", id] });
        queryClient.invalidateQueries({ queryKey: ["submissions"] });
        toast.success("Script received. Processing it and calculating the compliance score; it goes to the reviewers when that's done.");
        navigate("/submissions");
      } catch (err) {
        // The same script was already sent: for another date the creator confirms (the same dialog as posts).
        if (err instanceof ApiError && err.status === 409 && err.detail && typeof err.detail === "object" && "duplicates" in err.detail) {
          const detail = err.detail as { code: string; message: string; duplicates: DuplicateReport };
          if (detail.code === "REPOST_CONFIRM" && detail.duplicates.repost) setRepostAsk(detail.duplicates.repost);
          else toast.error(detail.message);
        } else {
          toast.error(`Error sending the script: ${(err as Error).message}`);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Sent back by a reviewer: the changes are checked again before the new version goes back.
    if (resubmitting && !recheck.compliance) {
      toast.error("Run the compliance check on your changes before resubmitting.");
      openStep("compliance");
      return;
    }
    if (resubmitting && !recheck.sentiment) {
      toast.error("Run the sentiment analysis on your changes before resubmitting.");
      openStep("sentiment");
      return;
    }
    // The steps count once they've run, but what's sent has to be what was checked: anything edited since is run again.
    if (checkStale) {
      toast.error("You've edited the post since the compliance check. Run the compliance check again before sending.");
      openStep("compliance");
      return;
    }
    if (submissionId) {
      const saved = await submissionService.list(undefined, "mine").catch(() => [] as SubmissionSummary[]);
      const steps = saved.find((s) => s.id === submissionId)?.steps;
      if (steps?.compliance === "stale") {
        toast.error("You've edited the post since the compliance check. Run the compliance check again before sending.");
        openStep("compliance");
        return;
      }
      if (steps?.sentiment === "stale") {
        toast.error("You've edited the post since the sentiment analysis. Run the sentiment analysis again before sending.");
        openStep("sentiment");
        return;
      }
    }
    if (duplicates?.blocked) {
      toast.error(`This is a duplicate of ${duplicates.blocking?.reference_code}. Change the submission details first.`);
      checkSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (duplicates?.repost && !confirmRepost) {
      setRepostAsk(duplicates.repost);
      return;
    }
    setSubmitting(true);
    try {
      const id = await save({ force: true });
      const result = await submissionService.submit(id!, confirmRepost);
      // Videos show up in the Content Screener from the server; open this one there next time.
      if (result.submission.files.some((f) => f.kind === "MAIN" && f.mime_type.startsWith("video/"))) {
        queryClient.invalidateQueries({ queryKey: ["review-queue"] });
        setActiveVideoId(`sub-${result.submission.id}`);
      }
      // The history page may hold cached copies from before this submit.
      queryClient.removeQueries({ queryKey: ["submission", result.submission.id] });
      queryClient.removeQueries({ queryKey: ["submission-history", result.submission.id] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      toast.success(
        `${result.submission.reference_code} ${resubmitting ? "resubmitted" : "sent"} for review (version ${result.submission.current_version}). Reviewers have been notified. Automated check: ${result.review_job.automated_check?.ai_unavailable ? "no score, the AI review couldn't run" : result.review_job.score == null ? "under review" : `${result.review_job.score}/100`}.`
      );
      // Sent: the submission page is done, so the creator goes back to My posts to follow it from there.
      navigate("/submissions");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.detail && typeof err.detail === "object" && "missing" in err.detail) {
        const missing = (err.detail as { missing: string[] }).missing;
        setServerMissing(missing);
        setShowErrors(true);
        setShowAllDetails(true);
        toast.error(`Please add: ${missing.map((m) => MISSING_LABELS[m] || m).join(", ")}.`);
      } else if (err instanceof ApiError && err.status === 409 && err.detail && typeof err.detail === "object" && "duplicates" in err.detail) {
        // The saved post repeats one already sent (the list on the page may have been a save behind).
        const detail = err.detail as { code: string; message: string; duplicates: DuplicateReport };
        queryClient.setQueryData(
          ["submission-duplicates", submissionId, checkedSub?.updated_at, files.map((f) => f.id).join(",")],
          detail.duplicates
        );
        duplicatesQuery.refetch();
        if (detail.code === "REPOST_CONFIRM" && detail.duplicates.repost) setRepostAsk(detail.duplicates.repost);
        else toast.error(detail.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Caption editor -----
  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    setCaption(editorRef.current?.innerText || "");
    markEdited();
  };

  /** Adds a hashtag or cashtag at the end of the caption: on the tag line if there is one, else on a new line. */
  const insertHashtag = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const text = (editor.innerText || "").replace(/\s+$/, "");
    const lastLine = text.split("\n").pop() ?? "";
    const onTagLine = /^\s*([#$][A-Za-z][\w.]*\s*)+$/.test(lastLine);
    const sep = !text ? "" : onTagLine ? " " : "\n\n";
    // The cursor sits after any trailing spaces or line breaks already typed; only add what's missing.
    const typedTail = (editor.innerText || "").slice(text.length);
    document.execCommand("insertText", false, `${typedTail ? sep.slice(Math.min(typedTail.length, sep.length)) : sep}${tag}`);
    setCaption(editor.innerText || "");
    markEdited();
  };

  /** Takes a hashtag or cashtag out of the caption (undo brings it back). */
  const removeHashtag = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\s?(?<![\\w#$])${escaped}(?![\\w])`, "i");
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const m = pattern.exec(node.textContent ?? "");
      if (!m) continue;
      editor.focus();
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("delete");
      setCaption(editor.innerText || "");
      markEdited();
      return;
    }
  };

  /** A suggested caption, in place of whatever is in the editor (undo brings the old one back). */
  const applySuggestedCaption = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("insertText", false, text);
    setCaption(editor.innerText || "");
    markEdited();
    toast.success("Caption added. Edit it as you like; it's checked with the rest of the post.");
  };

  // The main caption only has to fit the platforms that post it (not those with their own).
  const charLimit = useMemo(() => {
    const limits = platforms
      .filter((p) => !(p in platformCaptions))
      .map((p) => CHAR_LIMITS[p])
      .filter((n): n is number => typeof n === "number");
    return limits.length ? Math.min(...limits) : 2200;
  }, [platforms, platformCaptions]);

  const hashtagLibrary = useHashtagLibrary({ brands, audiences, region, platforms, ruleSets });

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "dirty"
      ? "Unsaved changes"
      : saveState === "error"
      ? "Not saved"
      : savedAt
      ? `Saved ${format(savedAt, "h:mm a")}`
      : "Not saved yet";

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading draft...
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300 min-[112.5rem]:max-w-[1800px]">
      <DashboardHeader
        title={referenceCode ? "Edit Submission" : "New Submission"}
        subtitle={referenceCode ? `${referenceCode} · Create a new content submission for compliance review and approval.` : "Create a new content submission for compliance review and approval."}
        actions={
          <>
            {submissionId && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 font-semibold"
                onClick={() => {
                  // Full reload gives a clean form for the next submission.
                  window.location.assign("/submissions/new");
                }}
              >
                <FilePlus2 className="w-3.5 h-3.5" /> Start Another
              </Button>
            )}
          </>
        }
      />

      {readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3.5 dark:border-blue-500/30 dark:bg-blue-500/10">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">In review: this post is locked</p>
            <p className="text-[13px] text-blue-950/80 dark:text-blue-100/80">
              You can look through every step and the results you ran before sending, but nothing can be changed or run again.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 bg-card text-xs" onClick={() => navigate(`/submissions/${submissionId}`)}>
            Open the post page
          </Button>
        </div>
      )}

      <PostStepNav
        current={stepView}
        states={{
          details: detailsComplete ? "done" : "todo",
          // Done once it has run; the compliance step itself says when the post changed since.
          compliance: resubmitting ? (recheck.compliance ? "done" : "stale") : hasCheck ? "done" : "todo",
          sentiment: resubmitting
            ? recheck.sentiment
              ? "done"
              : "stale"
            : sentimentAnalysis?.status === "COMPLETED"
            ? "done"
            : "todo",
          mood: mood ? "done" : "todo",
          ...(readOnly ? { send: "done" as const } : {}),
        }}
        onGo={openStep}
      />

      {resubmitting && submissionId && (
        <RevisionGuide
          reviewer={sentBack?.decided_by_name}
          note={sentBack?.decision_notes}
          dueAt={dueAt}
          openComments={reviewComments.filter((c) => !c.resolved_at).length}
          changesMade={changesMade}
          rechecked={recheck}
          submitting={submitting}
          onOpenStep={openStep}
          onResubmit={() => submit()}
        />
      )}

      {/* The reviewer's comments beside the content, where the edits are made: on the details step only. */}
      {resubmitting && submissionId && onDetails && (
        <RevisionWorkspace
          submissionId={submissionId}
          dueAt={dueAt}
          mainFile={files.find((f) => f.kind === "MAIN")}
          caption={caption}
          accept={ACCEPT_ALL}
          replacing={replacingMain}
          submitting={submitting}
          onReplace={replaceMain}
          onEditCaption={() => {
            captionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            window.setTimeout(() => editorRef.current?.focus(), 350);
          }}
          onDone={() => openStep("compliance")}
        />
      )}
      {resubmitting && canvaMain && onDetails && (
        <CanvaReimportBar file={canvaMain} resubmitting busy={reimporting || submitting} onReimport={reimportCanva} />
      )}

      <div className={`grid grid-cols-1 gap-4 sm:gap-5 items-start ${wideCompliance ? "" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        {/* ---------------- Form ---------------- */}
        <div id="step-details" className="space-y-4 min-w-0 scroll-mt-4">
          {/* Sent for review: the details can be read, not changed. */}
          <fieldset disabled={readOnly} className="contents">
          {showDetails && (
          <div className={onDetails ? "space-y-4" : "hidden"}>
          <Section step={1} title="The basics" description="What the post is, who it is for, and the rules it is checked against.">
            <div className="flex flex-col gap-5">
              <Field label="Title" required error={errorFor("title")}>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markEdited();
                  }}
                  maxLength={300}
                  placeholder="e.g. ZenaDrone 1000 – Autonomous Defense Capabilities"
                  className={`h-11 rounded-xl ${isMissing("title") ? "border-red-500" : ""}`}
                />
              </Field>

              <div className="space-y-2">
                <Label className="text-[13px] font-semibold text-foreground">What kind of post is it?</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Content type">
                  {CONTENT_TYPES.map(({ value, label, description, icon: Icon }) => {
                    const selected = contentType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        title={description}
                        onClick={() => {
                          if (value === contentType) return;
                          if (mainFiles.length > 0) {
                            toast.info("Your uploaded content file stays attached. Replace it if it doesn't match the new type.");
                          }
                          setContentType(value);
                          if (value === "AD") setRuleSets((prev) => (prev.includes(ADS_RULE_SET) ? prev : [...prev, ADS_RULE_SET]));
                          markEdited();
                        }}
                        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-border bg-card text-muted-foreground hover:border-slate-400 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{CONTENT_TYPES.find((c) => c.value === contentType)?.description}</p>
              </div>

              <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
              <Field label="Brand" required error={errorFor("brand_code", "Choose a brand")}>
                {!options ? (
                  <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">Loading brands...</div>
                ) : (
                  // One brand per post: its reviewers are the people who work on that brand.
                  <Select value={brands[0] ?? ""} onValueChange={(code) => onBrandsChange([code])}>
                    <SelectTrigger className={`w-full ${isMissing("brand_code") ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.brands.map((b) => (
                        <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {brands.length > 1 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    This draft had several brands; pick the one it's for. Make a separate post for each other brand.
                  </p>
                )}
              </Field>
              <Field label="Target Audience(s)" required error={errorFor("audience", "Choose at least one audience")}>
                {!options ? (
                  <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">Loading audiences...</div>
                ) : (
                  <MultiSelect<string>
                    options={Object.keys(options.audiences)}
                    value={audiences}
                    onChange={onAudiencesChange}
                    placeholder="Select audiences"
                    getLabel={(code) => options.audiences[code] ?? code}
                    invalid={isMissing("audience")}
                  />
                )}
              </Field>
                <div className="md:col-span-2">
                <Field label="Compliance Rule Set" required error={errorFor("rule_sets")}>
                <MultiSelect
                  options={options?.rule_sets ?? []}
                  value={ruleSets}
                  onChange={(next) => {
                    setRuleSets(next);
                    markEdited();
                  }}
                  placeholder="Select rule sets"
                  compact
                  invalid={isMissing("rule_sets")}
                />
                </Field>
                </div>
              </div>
              <div className="-mt-2">
              <p className="text-[11px] text-muted-foreground mt-0">
              Suggested automatically from the brand, audience and publishing account. You can add or remove any. Once
              sent, it goes to the review queue and a reviewer checks it before it's scheduled or posted.
              </p>
              </div>
            </div>
          </Section>

          <Section step={2} title="Where it goes" description="The accounts and platforms it posts through, and when.">
            <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
              <Field
                label="Publishing Account(s)"
                required
                error={errorFor("account_id", "Choose at least one connected account")}
                className="md:col-span-2"
           >
                {!options || brandAccounts.length === 0 ? (
                  <div className={`flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground ${isMissing("account_id") ? "border-red-500" : "border-input"}`}>
                    {!options ? "Loading accounts..." : "No connected accounts"}
                  </div>
                ) : (
                  <MultiSelect<string>
                    // Keep accounts that were picked before a brand change filtered them out of the list.
                    options={[...brandAccounts.map((a) => a.id), ...accountIds.filter((id) => !brandAccounts.some((a) => a.id === id))]}
                    value={accountIds}
                    onChange={onAccountsChange}
                    placeholder="Select accounts"
                    getLabel={(id) => {
                      const a = accounts.find((x) => x.id === id);
                      return a ? `${a.label}${a.is_demo ? " · demo" : ""}` : "Disconnected account";
                    }}
                    renderIcon={(id) => {
                      const a = accounts.find((x) => x.id === id);
                      return a ? <PlatformIcon platform={a.platform as SocialPlatform} className="w-3.5 h-3.5" /> : null;
                    }}
                    invalid={isMissing("account_id")}
                  />
                )}
                {options && brandAccounts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No connected accounts{brands.length ? ` for ${brandName}` : ""}. An admin can connect one under Integrations.
                  </p>
                )}
              </Field>
              <Field label="Platform(s)" required error={errorFor("platforms")}>
                <MultiSelect<string>
                  options={options?.platforms ?? []}
                  value={platforms}
                  onChange={(next) => {
                    setPlatforms(next);
                    markEdited();
                  }}
                  placeholder="Select platforms"
                  getLabel={(p) => PLATFORM_LABELS[p as SocialPlatform] ?? p}
                  renderIcon={(p) => <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />}
                  invalid={isMissing("platforms")}
                />
                {selectedAccounts.length > 0 && platformsWithoutAccount.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No publishing account selected for {platformsWithoutAccount.map((p) => PLATFORM_LABELS[p as SocialPlatform] ?? p).join(", ")} yet.
                  </p>
                )}
              </Field>
              <Field label="Region" required error={errorFor("region")}>
                <Select
                  value={region}
                  onValueChange={(v) => {
                    setRegion(v);
                    markEdited();
                  }}
                  disabled={!options}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.regions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Intended Publish Date"
                error={errorFor("publish_at", "Pick a date in the future")}
                
           >
                <Popover>
                  <div
                    className={`flex h-11 items-center gap-2 rounded-xl border bg-background px-3 ${
                      isMissing("publish_at") ? "border-red-500" : "border-input"
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                    <PopoverTrigger asChild>
                      <button type="button" className="flex-1 text-left text-sm min-w-0 truncate">
                        {publishDate ? format(publishDate, "MMM d, yyyy") : <span className="text-muted-foreground">Pick a date</span>}
                      </button>
                    </PopoverTrigger>
                    {publishDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setPublishDate(undefined);
                          markEdited();
                        }}
                        className="w-5 h-5 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                        aria-label="Clear date"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={publishDate}
                      onSelect={(d) => {
                        // Default to 9:00 AM local on the chosen day.
                        if (d) d.setHours(9, 0, 0, 0);
                        setPublishDate(d);
                        markEdited();
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </Field>
              <Field
                label="Need approval by"
                required
                error={errorFor(
                  "approval_needed_by",
                  approvalBy && publishDate && approvalBy> publishDate ? "Must be on or before the publish date" : approvalBy ? "Pick a date in the future" : "Required"
                )}
                
           >
                <Popover>
                  <div
                    className={`flex h-11 items-center gap-2 rounded-xl border bg-background px-3 ${
                      isMissing("approval_needed_by") ? "border-red-500" : "border-input"
                    }`}
                  >
                    <CalendarCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <PopoverTrigger asChild>
                      <button type="button" className="flex-1 text-left text-sm min-w-0 truncate">
                        {approvalBy ? format(approvalBy, "EEE, MMM d · h:mm a") : <span className="text-muted-foreground">Pick a date</span>}
                      </button>
                    </PopoverTrigger>
                    {approvalBy && (
                      <button
                        type="button"
                        onClick={() => {
                          setApprovalBy(undefined);
                          markEdited();
                        }}
                        className="w-5 h-5 rounded-full bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                        aria-label="Clear approval date"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <PopoverContent align="end" className="flex w-auto flex-row gap-0 p-0">
                    {/* Quick picks on the left (working days from now, at the chosen time), each showing its date. */}
                    <div className="flex w-36 flex-col gap-0.5 border-r border-border p-2" role="group" aria-label="Quick picks">
                      <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-muted-foreground">Quick picks</p>
                      {[
                        { days: 1, label: "In 1 day" },
                        { days: 3, label: "In 3 days" },
                        { days: 5, label: "In 1 week" },
                      ].map(({ days, label }) => {
                        const d = atApprovalTime(addBusinessDays(new Date(), days));
                        const tooLate = Boolean(publishDate && d > publishDate);
                        const picked = Boolean(approvalBy && isSameDay(approvalBy, d));
                        return (
                          <button
                            key={days}
                            type="button"
                            disabled={tooLate}
                            title={tooLate ? "After the publish date" : undefined}
                            aria-pressed={picked}
                            onClick={() => pickApproval(d)}
                            className={`flex flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              picked ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                            }`}
                          >
                            <span className="text-sm font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{format(d, "EEE, MMM d")}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-col">
                      <Calendar
                        mode="single"
                        selected={approvalBy}
                        defaultMonth={approvalBy ?? new Date()}
                        onSelect={(d) => pickApproval(d ? atApprovalTime(d) : undefined)}
                        disabled={publishDate ? [{ before: new Date() }, { after: publishDate }] : { before: new Date() }}
                      />
                      <div className="flex items-center gap-3 border-t border-border px-3 py-2.5">
                        <Label htmlFor="approval-time" className="text-xs font-medium text-muted-foreground">
                          Time
                        </Label>
                        <Select
                          value={approvalTime}
                          onValueChange={(t) => {
                            setApprovalTime(t);
                            if (approvalBy) pickApproval(withTime(approvalBy, t));
                          }}
                        >
                          <SelectTrigger id="approval-time" size="sm" className="h-8 flex-1 gap-2 text-sm">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" side="top" className="max-h-60">
                            {timeOptions(approvalTime).map((t) => (
                              <SelectItem key={t} value={t} className="text-sm">
                                {timeLabel(t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </Field>
            </div>
          </Section>


          <Section
            step={3}
            title={videoLocked ? "Script" : "Image and sources"}
            description={
              videoLocked
                ? "Video posts start with the script. Upload it and send it for review; the video and Canva upload open once it's approved."
                : "Upload your image or video, and any documents that back up your claims."
            }
          >
            {/* A blank script layout (title, storyline, hook, timed shot table) for writing scripts in Word. Videos only, until the script is approved. */}
            {contentType === "VIDEO" && scriptStage.data?.status !== "APPROVED" && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                Writing a script? Start from the template: title, storyline, hook and a timed shot table.
              </p>
              <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <a href={`${import.meta.env.BASE_URL}templates/script-template.docx`} download="script-template.docx">
                  <Download className="w-3.5 h-3.5" />
                  Export template (.docx)
                </a>
              </Button>
            </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ALL}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <input
              ref={scriptInputRef}
              type="file"
              accept={ACCEPT_SCRIPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(Array.from(e.target.files), { asScript: true });
                e.target.value = "";
              }}
            />
            {scriptFirst && (
              <ScriptStageCard
                submissionId={submissionId}
                stage={scriptStage.data}
                canEdit={status === "DRAFT" || status === "CHANGES_REQUESTED"}
                onAddScript={() => scriptInputRef.current?.click()}
                onSend={() => submit()}
                sending={submitting}
                invalid={isMissing("script")}
              />
            )}
            {/* Two ways to add content: upload files, or import a Canva design. A video post waiting on its script
                only has the script card above; both open once the script is approved. */}
            {!videoLocked && (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => (needScriptFirst ? scriptInputRef : fileInputRef).current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (needScriptFirst ? scriptInputRef : fileInputRef).current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingMain(true);
              }}
              onDragLeave={() => setIsDraggingMain(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingMain(false);
                if (needScriptFirst) {
                  toast.info("Upload your script first. Once it's in, you can add other files.");
                  return;
                }
                if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files));
              }}
              className={`min-h-[190px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-1.5 p-6 cursor-pointer transition-colors ${
                isDraggingMain
                  ? "border-blue-500 bg-blue-500/10"
                  : isMissing("main_file")
                  ? "border-red-400 bg-red-500/5"
                  : "border-blue-300 dark:border-blue-500/40 bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <span className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">{needScriptFirst ? "Upload your script first" : "Drag & drop files here"}</span>
              <span className="text-xs text-muted-foreground max-w-md">
                {needScriptFirst
                  ? "Start by uploading the script (PDF, Word or .txt). Once it's in, you can add a cover image and other files here. Your video can go in once the script is approved."
                  : videoLocked
                  ? "Add a cover image or supporting documents now. Your video can go in once the script is approved."
                  : `Add ${mainUpload.main}, plus any extra images or supporting documents. You can select several files at once.`}
              </span>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-2xs">
                <CloudUpload className="w-3.5 h-3.5" /> {needScriptFirst ? "Upload the script" : "Choose Files"}
              </span>
              {!needScriptFirst && (
                <span className="text-[11px] text-muted-foreground mt-1">
                  Video (MP4, MOV, AVI, WEBM up to 2 GB) · Images (JPG, PNG, WebP) · Documents (PDF, DOC, TXT, XLSX, ZIP)
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCanvaOpen(true)}
              disabled={!canvaFits || videoLocked}
              title={
                videoLocked
                  ? "Get the script approved first, then add the video"
                  : canvaFits
                  ? undefined
                  : "Canva designs can't be the main file of a blog or article"
              }
              className="min-h-[190px] rounded-xl border border-[#7d2ae8]/30 bg-[#7d2ae8]/5 hover:bg-[#7d2ae8]/10 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 p-5 text-center transition-colors"
            >
              <CanvaMark className="w-11 h-11 text-base" />
              <span className="text-sm font-semibold text-foreground">Import from Canva</span>
              <span className="text-xs text-muted-foreground">Pick a design from your Canva account. It's reviewed like any upload.</span>
              <span className={`mt-1 inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${CANVA_PURPLE}`}>Choose a design</span>
            </button>
            </div>
            )}
            {!scriptFirst && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => scriptInputRef.current?.click()}
              >
                <FileText className="w-3.5 h-3.5" />
                {files.some((f) => f.kind === "SCRIPT") ? "Replace the script" : "Add a script"}
              </Button>
              <span>
                PDF, Word (.docx), .txt or .md. Its text is checked against the rulebook with the rest of the post. Files
                with "script" in the name are picked up as the script automatically.
              </span>
            </div>
            )}
            {isMissing("main_file") && (
              <p className="text-[11px] text-red-600 mt-1.5">
                Add {mainUpload.main} to submit this {CONTENT_TYPES.find((c) => c.value === contentType)?.label.toLowerCase()}.
              </p>
            )}

            {(files.length > 0 || uploading.length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Uploaded files <span className="font-normal text-muted-foreground">({files.length})</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {files.map((f) => (
                    <SubmissionFileRow key={f.id} file={f} removing={removingId === f.id} onRemove={readOnly ? undefined : () => removeFile(f)} />
                  ))}
                  {uploading.map((u) => (
                    <div key={u.key} className="flex items-center gap-3 rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground min-h-[58px]">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="truncate">Uploading {u.name}...</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mainFiles.length > 0 && !caption.trim() && !suggesterOpen && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">Your post is in.</span>{" "}
                  <span className="text-muted-foreground">It needs a caption: write one in section 4, or have one suggested from it.</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] gap-1"
                  onClick={() => {
                    setSuggesterOpen(true);
                    captionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Sparkles className="w-3 h-3 text-violet-500" /> Create a caption
                </Button>
              </div>
            )}
            {canvaMain && !resubmitting && (
              <div className="mt-3">
                <CanvaReimportBar file={canvaMain} resubmitting={false} busy={reimporting} onReimport={reimportCanva} />
              </div>
            )}
            <CanvaImportDialog
              open={canvaOpen}
              onOpenChange={setCanvaOpen}
              contentType={contentType}
              ensureSubmissionId={() => save({ force: true })}
              onImported={onCanvaImported}
            />
          </Section>
          </div>
          )}

          {resubmitting && (
            <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 ${onDetails ? "" : "hidden"}`}>
              <p className="text-xs text-muted-foreground">
                {showAllDetails
                  ? "All details are open. Anything you change is part of the next version."
                  : "Type, brand, platforms, files and rule sets stay as they were. Open them only if the reviewer asked."}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAllDetails((v) => !v)}>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllDetails ? "rotate-180" : ""}`} />
                {showAllDetails ? "Hide details" : "Show all details"}
              </Button>
            </div>
          )}

          <div ref={captionSectionRef} className={`scroll-mt-4 ${onDetails ? "" : "hidden"}`}>
          <Section
            step={4}
            title="Caption"
            description="Required. Write or paste your caption, script, or copy, or have one suggested from your post."
          >
            <div className={`rounded-lg border ${isMissing("caption") ? "border-red-500" : "border-input"} overflow-hidden`}>
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/30 px-2 py-1.5">
                <Select defaultValue="p" onValueChange={(v) => exec("formatBlock", v)}>
                  <SelectTrigger size="sm" className="h-7 w-[120px] text-xs border-0 bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p" className="text-xs">Paragraph</SelectItem>
                    <SelectItem value="h2" className="text-xs">Heading</SelectItem>
                    <SelectItem value="h3" className="text-xs">Subheading</SelectItem>
                    <SelectItem value="blockquote" className="text-xs">Quote</SelectItem>
                  </SelectContent>
                </Select>
                <span className="w-px h-5 bg-border mx-1" />
                {[
                  { icon: Bold, cmd: "bold", label: "Bold" },
                  { icon: Italic, cmd: "italic", label: "Italic" },
                  { icon: Underline, cmd: "underline", label: "Underline" },
                  { icon: List, cmd: "insertUnorderedList", label: "Bulleted list" },
                  { icon: ListOrdered, cmd: "insertOrderedList", label: "Numbered list" },
                ].map(({ icon: Icon, cmd, label }) => (
                  <Button key={cmd} type="button" size="icon" variant="ghost" className="h-7 w-7" title={label} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd)}>
                    <Icon className="w-3.5 h-3.5" />
                  </Button>
                ))}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Insert link"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const url = safeHref(window.prompt("Link URL", "https://"));
                    if (url) exec("createLink", url);
                    else toast.error("Links must start with https://, http:// or mailto:.");
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                </Button>
                <span className="flex-1" />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-violet-700 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/15 mr-1"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSuggesterOpen(true)}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Suggest a caption
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15">
                      <Hash className="w-3.5 h-3.5" /> Hashtags
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-2.5">
                    <p className="text-[11px] font-semibold text-foreground px-1 pb-1">
                      Hashtags for {brandName || "ZenaTech brands"}
                    </p>
                    <HashtagPicker
                      library={hashtagLibrary.data}
                      loading={hashtagLibrary.isLoading}
                      caption={caption}
                      hasBrand={brands.length > 0}
                      onAdd={insertHashtag}
                      onRemove={removeHashtag}
                    />
                  </PopoverContent>
                </Popover>
                <span className="w-px h-5 bg-border mx-1" />
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Undo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")}>
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" title="Redo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")}>
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div
                ref={editorRef}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Caption or copy"
                data-placeholder="Write your caption, script, or copy here..."
                onInput={(e) => {
                  setCaption(e.currentTarget.innerText);
                  markEdited();
                }}
                onPaste={(e) => {
                  // Pasted rich text (from Word, a web page...) keeps its formatting but nothing unsafe.
                  e.preventDefault();
                  const html = e.clipboardData.getData("text/html");
                  if (html) document.execCommand("insertHTML", false, sanitizeCaptionHtml(html));
                  else document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                  setCaption(e.currentTarget.innerText);
                  markEdited();
                }}
                className="min-h-[180px] max-h-[480px] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none bg-background empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>
            <p className={`text-[11px] text-right mt-1.5 ${caption.trim().length > charLimit ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
              {caption.trim().length.toLocaleString()}/{charLimit.toLocaleString()} characters
              {platforms.length > 0 && caption.trim().length > charLimit && " (too long for one of the selected platforms)"}
            </p>
            <CaptionSignalsBar
              caption={caption}
              maxHashtags={hashtagLibrary.data?.max_hashtags ?? null}
              maxReason={hashtagLibrary.data?.max_reason}
              ruleSets={ruleSets}
              audiences={audiences}
              onAddInvestors={() => onAudiencesChange([...audiences, "INVESTORS"])}
            />
            {platforms.length > 1 && (
              <PlatformCaptions
                platforms={platforms}
                captions={platformCaptions}
                mainCaption={caption}
                limitFor={(p) => CHAR_LIMITS[p]}
                readOnly={readOnly}
                onChange={(next) => {
                  setPlatformCaptions(next);
                  markEdited();
                }}
              />
            )}
            {isMissing("caption") && (
              <p className="text-[11px] text-red-600">
                Add a caption. It's what the compliance score and sentiment analysis read first; you can have one suggested from
                your post.
              </p>
            )}
            {suggesterOpen && (
              <CaptionSuggester
                submissionId={submissionId}
                ensureSubmissionId={() => save({ force: true })}
                maxChars={charLimit}
                hasCaption={Boolean(caption.trim())}
                onUse={applySuggestedCaption}
                onClose={() => setSuggesterOpen(false)}
              />
            )}
          </Section>
          </div>
          </fieldset>

          {showDetails && (
          <div className={toolView("mood") ? "" : "hidden"}>
          <Section
            id="step-mood"
            step={4}
            title="Market & News Sentiment"
            description="Live industry conversation on X and news outlets for your post's topics, and whether posting now carries backlash risk."
          >
            {submissionId ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Globe2 className="h-4 w-4 shrink-0 text-sky-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {moodDecision
                          ? moodDecision.reason
                          : mood?.topics.length
                          ? `${mood.topics.length} matched topic${mood.topics.length === 1 ? "" : "s"} found in current conversation`
                          : "No negative crisis or backlash topics matched in current feeds."}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {mood?.topics.length
                          ? `Topics: ${mood.topics.map((t) => t.name).join(", ")}`
                          : "Topics are matched continuously from your title, caption, script and video transcript."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {moodDecision && (
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${REC_BADGE[moodDecision.recommendation].cls}`}>
                        {moodDecision.recommendation}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => refreshMood()}
                      disabled={moodLoading}
                      hidden={readOnly}
                    >
                      {moodLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
                    </Button>
                  </div>
                </div>

                <TopicTrend
                  submissionId={submissionId}
                  mood={mood}
                  isLoading={moodLoading}
                  canEdit={!readOnly}
                  busy={dismissTopic.isPending}
                  onDismiss={(topicId) => dismissTopic.mutate({ topicId })}
                  onRestore={(topicId) => dismissTopic.mutate({ topicId, restore: true })}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 p-4 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <Globe2 className="h-4 w-4 shrink-0 text-sky-600" />
                  <span className="text-xs text-muted-foreground">
                    Save your draft to check live social sentiment and industry news on your topics before sending for review.
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => saveNow()}
                >
                  <Save className="w-3 h-3" /> Check Sentiment
                </Button>
              </div>
            )}
          </Section>
          </div>
          )}

          {gated && <StepGate missing={detailsMissing} onBack={() => goToStep("details")} />}

          {toolView("compliance") && !videoLocked && (
            <div id="step-compliance" className="scroll-mt-4">
              <ComplianceStep
                sub={checkedSub}
                title={title}
                caption={caption}
                mainFile={mainFiles[0]}
                editable={!readOnly}
                checking={checking}
                stale={checkStale}
                progress={<CheckProgress attempts={checkAttempts} startedAt={checkStartedAt} />}
                extra={
                  checkedSub?.latest_check ? (
                    lastCheckMs != null && checkAttempts.length > 0 ? (
                      <CheckModelsUsed attempts={checkAttempts} durationMs={lastCheckMs} />
                    ) : (
                      <SavedCheckModels models={checkedSub.latest_check.models} />
                    )
                  ) : null
                }
                onCheck={() => void runComplianceCheck()}
                onEditCaption={backToCaption}
                onReplaceMedia={() => goToStep("details")}
              />
            </div>
          )}

          <div ref={checkSectionRef} className={`scroll-mt-4 ${onDetails || stepView === "mood" || gated || (toolView("compliance") && !videoLocked) ? "hidden" : ""}`}>
          <Section
            step={STEP_NUMBER[stepView]}
            title={STEP_TITLE[stepView]}
            description={STEP_DESCRIPTION[stepView]}
          >
            <div className="flex flex-col gap-4">
              {videoLocked ? (
                <p className={`flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground ${stepView === "send" ? "hidden" : ""}`}>
                  <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Your script is checked first: open it from the script card above to see its compliance score. The
                  compliance check and sentiment analysis of the video and caption open here once the script is approved.
                </p>
              ) : (
                <>
                  {/* Compliance: the same rulebook check the reviewer sees */}
                  <div className={`scroll-mt-4 rounded-xl border border-border/80 p-3.5 space-y-3 ${toolView("compliance") ? "" : "hidden"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Compliance check</p>
                          <p className="text-[11px] text-muted-foreground">
                            Regulatory, legal and brand messaging rules for the selected rule sets, audience and region.
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={hasCheck && !checkStale ? "outline" : "default"}
                        className={`h-7 gap-1.5 text-xs ${hasCheck && !checkStale ? "" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                        onClick={() => void runComplianceCheck()}
                        disabled={checking || uploading.length > 0}
                      >
                        {checking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : hasCheck ? (
                          <RefreshCw className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        {hasCheck ? "Check again" : "Run compliance check"}
                      </Button>
                    </div>
                    {checking ? (
                      <CheckProgress attempts={checkAttempts} startedAt={checkStartedAt} />
                    ) : checkedSub?.latest_check ? (
                      <>
                        {checkStale && (
                          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                            You've edited the post since this check. Check again to see the score for your latest changes.
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {lastCheckMs != null && !checkStale ? "New result" : "Last result"}
                          {checkedSub.latest_check.checked_at
                            ? ` · checked ${format(new Date(checkedSub.latest_check.checked_at), "MMM d, h:mm:ss a")}`
                            : ""}
                        </p>
                        {lastCheckMs != null && <CheckModelsUsed attempts={checkAttempts} durationMs={lastCheckMs} />}
                        <ComplianceView
                          sub={checkedSub}
                          outdatedText="The rulebook has changed since this check. Check again to use the current rules."
                        />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Not checked yet. Run it to see your score and anything a reviewer would flag; it saves your draft first.
                      </p>
                    )}
                  </div>

                  {/* Sentiment: the same tone and reputational-risk analysis the reviewer sees */}
                  <div id="step-sentiment" className={`scroll-mt-4 ${toolView("sentiment") ? "" : "hidden"}`}>
                    <SentimentPanel
                      submissionId={submissionId}
                      showTopicTrends={false}
                      canRun={!readOnly}
                      design
                      beforeAnalyse={async () => {
                        if (!detailsComplete) {
                          toast.error(`Fill in the required fields before running the analysis: ${detailsMissing.join(", ")}.`);
                          return false;
                        }
                        try {
                          await save({ force: true });
                          return true;
                        } catch (err) {
                          toast.error(`Couldn't save the draft: ${(err as Error).message}`);
                          return false;
                        }
                      }}
                    />
                  </div>
                </>
              )}

              {readOnly && toolView("send") && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                  <p className="font-semibold">Sent for review{sentAt ? ` on ${format(new Date(sentAt), "MMM d, yyyy 'at' h:mm a")}` : ""}</p>
                  <p className="mt-1 text-[13px] text-blue-950/80 dark:text-blue-100/80">
                    It's with the reviewer now. You'll get a notification when they decide.
                  </p>
                </div>
              )}

              {/* Who it goes to, and the send itself */}
              <div id="step-send" className={`scroll-mt-4 rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3 ${toolView("send") && !readOnly ? "" : "hidden"}`}>
                <Field
                  label="Send to reviewers"
                  required
                  error={errorFor("reviewer_ids", "Pick at least one reviewer")}
                >
                  {reviewersQuery.isSuccess && reviewerOptions.length === 0 ? (
                    <div
                      className={`flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground ${
                        isMissing("reviewer_ids") ? "border-red-500" : "border-input"
                      }`}
                    >
                      No reviewers yet{brands.length ? ` for ${brands.length === 1 ? "this brand" : "these brands"}` : ""}
                    </div>
                  ) : (
                    <MultiSelect<string>
                      options={reviewerOptions.map((r) => r.id)}
                      value={pickedReviewers}
                      onChange={(ids) => {
                        setReviewerIds(ids);
                        markEdited();
                      }}
                      placeholder={
                        reviewersQuery.isLoading
                          ? "Loading reviewers..."
                          : reviewersQuery.isError
                          ? "Couldn't load reviewers"
                          : "Pick reviewers"
                      }
                      getLabel={(id) => {
                        const r = reviewerOptions.find((x) => x.id === id);
                        return r ? `${r.name}${r.is_super_admin ? " · Super admin" : ""}` : "Reviewer";
                      }}
                      getSearchText={(id) => reviewerOptions.find((x) => x.id === id)?.email ?? ""}
                      renderIcon={() => <Users className="w-3.5 h-3.5 text-muted-foreground" />}
                      invalid={isMissing("reviewer_ids")}
                      searchable
                      selectAll
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {reviewersQuery.isSuccess && reviewerOptions.length === 0
                      ? "Add users and give them a reviewer role (System & Security) to send them content."
                      : "Only the people you pick see this post and get its notifications. Final approvers for its brands are always included."}
                  </p>
                </Field>
                {!videoLocked && duplicates && <DuplicateNotice report={duplicates} publishAt={publishDate ?? null} />}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <p className="text-[11px] text-muted-foreground">
                    {!videoLocked && duplicates?.blocked
                      ? "Duplicate post: change the submission details above to send it."
                      : videoLocked
                      ? "Sends your script to the reviewers you picked."
                      : !hasCheck
                      ? "You haven't run the compliance check yet. It also runs when you send."
                      : checkStale
                      ? "Edited since your last check. It runs again when you send."
                      : "Ready when you are. The reviewer sees the same check and analysis."}
                  </p>
                  <Button
                    type="button"
                    onClick={() => submit()}
                    disabled={submitting || checking || uploading.length > 0 || (!videoLocked && !!duplicates?.blocked)}
                    className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {videoLocked ? "Send Script for Review" : resubmitting ? "Resubmit for Review" : "Send for Review"}
                  </Button>
                </div>
              </div>
            </div>
          </Section>
          </div>

          {/* Details: the duplicate check happens on the way to the compliance step */}
          {onDetails && dupChecked && dupChecked.edit === editCounter && (dupChecked.report.blocked || dupChecked.report.repost) && (
            <DuplicateNotice report={dupChecked.report} publishAt={publishDate ?? null} />
          )}
          {onDetails && (
            <StepFooter
              busy={continuing}
              onSave={readOnly ? undefined : saveNow}
              saving={saveState === "saving"}
              next={{ label: "Continue to compliance rules", onClick: () => (readOnly ? goToStep("compliance") : void leaveDetails("compliance")) }}
            />
          )}
          {!onDetails && !gated && (
            <StepFooter
              onSave={readOnly ? undefined : saveNow}
              saving={saveState === "saving"}
              back={{
                label: `Back: ${STEP_TITLE[POST_STEPS[Math.max(STEP_NUMBER[stepView] - 2, 0)].key]}`,
                onClick: () => goToStep(POST_STEPS[Math.max(STEP_NUMBER[stepView] - 2, 0)].key),
              }}
              next={
                stepView === "send"
                  ? undefined
                  : {
                      label: `Continue to ${STEP_TITLE[POST_STEPS[STEP_NUMBER[stepView]].key].toLowerCase()}`,
                      onClick: () => goToStep(POST_STEPS[STEP_NUMBER[stepView]].key),
                    }
              }
            />
          )}

          <AlertDialog
            open={!!repostAsk}
            onOpenChange={(open) => {
              if (!open) {
                setRepostAsk(null);
                setRepostTarget(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send the same post again?</AlertDialogTitle>
                <AlertDialogDescription>
                  {repostAsk && (
                    <>
                      The same post had already been sent for approval
                      {repostAsk.submitted_at ? ` on ${format(new Date(repostAsk.submitted_at), "MMM d, yyyy")}` : ""} as{" "}
                      {repostAsk.reference_code}, for{" "}
                      {repostAsk.publish_at ? format(new Date(repostAsk.publish_at), "MMM d, yyyy") : "no publish date"}. Do you
                      want to continue for {publishDate ? format(publishDate, "MMM d, yyyy") : "no publish date"}?
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not now</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setRepostAsk(null);
                    if (repostTarget) {
                      const target = repostTarget;
                      setRepostTarget(null);
                      goToStep(target);
                    } else {
                      submit(true);
                    }
                  }}
                >
                  Continue for this date
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* ---------------- Summary ---------------- */}
        <div className={`space-y-3 xl:sticky xl:top-0 ${wideCompliance ? "hidden" : ""}`}>
          {onDetails && (
            <Card className="py-0 gap-0 rounded-2xl border-border/70 shadow-xs">
              <div className="px-5 pt-5 pb-2">
                <h2 className="text-base font-bold text-foreground">Ready to continue</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detailsComplete ? "Everything required is in." : `${detailsMissing.length} still to fill in.`}
                </p>
              </div>
              <ul className="space-y-1.5 px-5 pb-5">
                {Object.entries(MISSING_LABEL)
                  .filter(([key]) => key in clientMissing && (key !== "script" || scriptFirst) && (key !== "main_file" || MAIN_REQUIRED.includes(contentType)))
                  .map(([key, label]) => {
                    const missing = (clientMissing as Record<string, boolean>)[key];
                    return (
                      <li key={key} className="flex items-center gap-2 text-[13px]">
                        <span className={`grid h-4 w-4 place-items-center rounded-full ${missing ? "border border-border" : "bg-blue-600 text-white"}`}>
                          {!missing && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className={missing ? "text-muted-foreground" : "font-medium text-foreground"}>{label}</span>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}
          <Card className="py-0 gap-0 rounded-2xl border-border/70 shadow-xs">
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4.5 h-4.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">Submission Summary</h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {referenceCode ? (
                      <>
                        <span className="font-mono font-semibold text-foreground">{referenceCode}</span> · {saveLabel}
                      </>
                    ) : (
                      "Saved automatically once you start."
                    )}
                  </p>
                </div>
              </div>
              <SubmissionStatusBadge status={status} />
            </div>

            <div className="px-4 divide-y divide-border/50">
              <SummaryRow icon={ContentTypeIcon} label="Content Type">
                <span className="inline-flex items-center gap-1.5">
                  <ContentTypeIcon className="w-4 h-4" />
                  {CONTENT_TYPES.find((c) => c.value === contentType)?.label}
                </span>
              </SummaryRow>
              <SummaryRow icon={FileText} label="Title">
                {title.trim() || <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={Building2} label="Brand">
                {brandName || <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={Users} label={selectedAccounts.length > 1 ? "Accounts" : "Account"}>
                {selectedAccounts.length > 0 ? (
                  <span className="flex flex-col gap-1">
                    {selectedAccounts.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5">
                        <PlatformIcon platform={a.platform as SocialPlatform} className="w-4 h-4" />
                        {a.label}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </SummaryRow>
              <SummaryRow icon={Layers} label="Platforms">
                {platforms.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {platforms.map((p) => (
                      <span key={p} title={PLATFORM_LABELS[p as SocialPlatform] ?? p}>
                        <PlatformIcon platform={p as SocialPlatform} className="w-5 h-5" />
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </SummaryRow>
              <SummaryRow icon={Users} label="Target Audience">
                {audienceLabel || <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={Globe} label="Region">
                {region || <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={CalendarDays} label="Intended Publish Date">
                {publishDate ? format(publishDate, "MMM d, yyyy") : <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={CalendarCheck} label="Need approval by">
                {approvalBy ? format(approvalBy, "MMM d, h:mm a") : <span className="text-muted-foreground">—</span>}
              </SummaryRow>
              <SummaryRow icon={Globe2} label="Market Sentiment">
                {moodDecision ? (
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${REC_BADGE[moodDecision.recommendation].cls}`}>
                      {moodDecision.recommendation}
                    </span>
                    <span className="text-xs leading-snug text-foreground/80" title={moodDecision.reason}>
                      {moodDecision.reason}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Unmonitored / Neutral</span>
                )}
              </SummaryRow>
            </div>

            <div className="px-4 pt-3 pb-4 border-t border-border/60 mt-1">
              <p className="text-xs font-semibold text-foreground mb-2">Content Files</p>
              {files.length === 0 && uploading.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3 text-center">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <SubmissionFileRow key={f.id} file={f} removing={removingId === f.id} onRemove={readOnly ? undefined : () => removeFile(f)} />
                  ))}
                  {uploading.map((u) => (
                    <div key={u.key} className="flex items-center gap-3 rounded-lg border border-dashed border-border p-2 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      <span className="truncate">Uploading {u.name}...</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </Card>

          {optionsQuery.isError && (
            <p className="text-[11px] text-red-600">Couldn't load brands and accounts. Refresh to try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
