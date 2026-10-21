import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bold,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  FilePlus2,
  FileText,
  GalleryHorizontalEnd,
  Globe,
  Hash,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  Loader2,
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
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { MISSING_LABELS, SubmissionFileRow, SubmissionStatusBadge } from "@/components/submissions/submissionUi";
import SentimentPanel from "@/components/submissions/SentimentPanel";
import { useVideoUploadQueue } from "@/context/VideoUploadQueueContext";
import { submissionService } from "@/services/submissionService";
import { ApiError } from "@/services/helper";
import type {
  AccountOption,
  ContentType,
  StoredCheck,
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
];

const MAIN_UPLOAD: Record<ContentType, { main: string }> = {
  VIDEO: { main: "your video" },
  SOCIAL_POST: { main: "your image or video" },
  CAROUSEL: { main: "your carousel images" },
  IMAGE: { main: "your image" },
  BLOG: { main: "your article" },
};

const ACCEPT_ALL = "video/*,image/*,.mp4,.mov,.avi,.webm,.mkv,.m4v,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.zip,.ppt,.pptx";
const VIDEO_RE = /\.(mp4|mov|avi|webm|mkv|m4v)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
const ARTICLE_RE = /\.(pdf|docx?|md|txt)$/i;
const DOC_RE = /\.(pdf|docx?|md|txt|xlsx?|csv|zip|pptx?)$/i;

/**
 * Decide what each dropped file is: the main content asset, an extra image, or a supporting document.
 * Returns null with a reason for files this submission can't take.
 */
function classifyFile(file: File, type: ContentType, mainTaken: boolean): { kind: SubmissionFileKind } | { error: string } {
  const name = file.name;
  const isVideo = VIDEO_RE.test(name) || file.type.startsWith("video/");
  const isImage = IMAGE_RE.test(name) || file.type.startsWith("image/");
  const isMainType =
    (type === "VIDEO" && isVideo) ||
    ((type === "IMAGE" || type === "CAROUSEL") && isImage) ||
    (type === "SOCIAL_POST" && (isVideo || isImage)) ||
    (type === "BLOG" && ARTICLE_RE.test(name));

  if (isMainType && (type === "CAROUSEL" || !mainTaken)) return { kind: "MAIN" };
  if (isVideo) {
    return {
      error: mainTaken && (type === "VIDEO" || type === "SOCIAL_POST")
        ? "only one video per submission. Remove the current one to replace it."
        : "videos can only be added to Video or Social Post submissions.",
    };
  }
  if (isImage) return { kind: "IMAGE" };
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

const HASHTAGS: Record<string, string[]> = {
  ZENATECH: ["#ZenaTech", "#DroneTech", "#AI", "#Innovation"],
  ZENADRONE: ["#ZenaDrone", "#DefenseInnovation", "#AutonomousSystems", "#Drones"],
  DAAS: ["#DroneAsAService", "#DaaS", "#ZenaTech"],
  ZOOOFFICE: ["#ZooOffice", "#FutureOfWork", "#ZenaTech"],
  ZENASTUDIOS: ["#ZenaStudios", "#CreativeTech"],
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Section({ step, title, description, children }: { step: number; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="py-0 gap-0 border-border/80 shadow-xs">
      <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 pb-3">
        <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-4 sm:px-5 pb-5">{children}</div>
    </Card>
  );
}

function Field({ label, required, error, children, className = "" }: { label: string; required?: boolean; error?: string | false; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <Label className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Select-style box that holds removable chips; options open in a popover. */
function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  renderIcon,
  getLabel = (v) => v,
  invalid,
  compact,
}: {
  options: T[];
  value: T[];
  onChange: (next: T[]) => void;
  placeholder: string;
  renderIcon?: (v: T) => ReactNode;
  getLabel?: (v: T) => string;
  invalid?: boolean;
  compact?: boolean;
}) {
  const toggle = (opt: T) => onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          className={`min-h-9 w-full flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-left cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            invalid ? "border-red-500" : "border-input"
          }`}
        >
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {value.length === 0 && <span className="text-sm text-muted-foreground px-1">{placeholder}</span>}
            {value.map((v) => (
              <span
                key={v}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-medium ${
                  compact
                    ? "text-[11px] border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "text-xs border-border bg-muted/60 text-foreground"
                }`}
              >
                {renderIcon?.(v)}
                {getLabel(v)}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${getLabel(v)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-1">
        {options.map((opt) => {
          const checked = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted text-left"
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  checked ? "bg-blue-600 border-blue-600 text-white" : "border-input"
                }`}
              >
                {checked && <Check className="w-3 h-3" />}
              </span>
              {renderIcon?.(opt)}
              {getLabel(opt)}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
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

function CheckResult({ check }: { check: StoredCheck }) {
  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${
          check.traffic_light === "RED"
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : check.traffic_light === "YELLOW"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {check.traffic_light === "RED" ? (
            <XCircle className="w-4 h-4" />
          ) : check.traffic_light === "YELLOW" ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {check.is_compliant ? "No issues found" : `${check.violations_count} potential issue${check.violations_count === 1 ? "" : "s"}`}
        </span>
        <span>Score {check.score}/100</span>
      </div>
      {check.rules_checked != null && (
        <p className={`text-[11px] ${check.rules_checked === 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
          {check.rules_checked === 0
            ? "No rules apply to the chosen rule sets yet, so nothing was checked."
            : `Checked against ${check.rules_checked} rule${check.rules_checked === 1 ? "" : "s"} for the chosen rule sets, brand, audience, region and platforms.`}
        </p>
      )}
      {check.violations.map((v) => (
        <div key={v.rule_id} className="rounded-lg border border-border/70 p-2.5 space-y-1">
          <p className="text-xs font-semibold text-foreground">
            {v.rule_number} · {v.title}
          </p>
          <p className="text-[11px] text-muted-foreground">Flagged: {v.flagged_terms.map((t) => `"${t}"`).join(", ")}</p>
          {v.remediation_guidance && <p className="text-[11px] text-foreground/80">Fix: {v.remediation_guidance}</p>}
        </div>
      ))}
      {check.checked_at && (
        <p className="text-[10px] text-muted-foreground">Checked {format(new Date(check.checked_at), "MMM d, h:mm a")}</p>
      )}
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
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 60_000 });
  const options = optionsQuery.data;

  // Submission identity and server state
  const [submissionId, setSubmissionId] = useState<string | null>(routeId);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmissionStatus>("DRAFT");
  const [loadingExisting, setLoadingExisting] = useState(Boolean(routeId));
  const idRef = useRef<string | null>(routeId);

  // Form fields
  const [contentType, setContentType] = useState<ContentType>("VIDEO");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [accountId, setAccountId] = useState("");
  const [audience, setAudience] = useState("");
  const [region, setRegion] = useState("Global");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [publishDate, setPublishDate] = useState<Date | undefined>(undefined);
  const [caption, setCaption] = useState("");
  const [ruleSets, setRuleSets] = useState<string[]>(["Public Company Disclosure"]);
  const [reviewers, setReviewers] = useState<string[]>(["Marketing Review", "Compliance Review"]);

  // Files, checks and save status
  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [uploading, setUploading] = useState<{ key: string; name: string; kind: SubmissionFileKind }[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [check, setCheck] = useState<StoredCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [editCounter, setEditCounter] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const [isDraggingMain, setIsDraggingMain] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveChain = useRef<Promise<string | null>>(Promise.resolve(null));
  // A draft this page just created; the URL update that follows mustn't reload it over the user's typing.
  const createdIdRef = useRef<string | null>(null);
  const pendingCaptionHtml = useRef<string | null>(null);

  const markEdited = () => {
    setEditCounter((n) => n + 1);
    setSaveState("dirty");
    setServerMissing([]);
  };

  const accounts = useMemo(() => options?.accounts ?? [], [options]);
  const account = accounts.find((a) => a.id === accountId);
  const brandAccounts = useMemo(
    () => accounts.filter((a) => !brand || !a.brand_code || a.brand_code === brand),
    [accounts, brand]
  );
  const brandName = options?.brands.find((b) => b.code === brand)?.name;
  const audienceLabel = audience ? options?.audiences[audience] : undefined;
  const mainUpload = MAIN_UPLOAD[contentType];
  const ContentTypeIcon = CONTENT_TYPES.find((c) => c.value === contentType)!.icon;

  // ----- Load an existing draft (S08 resume) -----
  const applyServer = useCallback((s: Submission) => {
    setSubmissionId(s.id);
    idRef.current = s.id;
    setReferenceCode(s.reference_code);
    setStatus(s.status);
    setFiles(s.files);
    setCheck(s.latest_check ?? null);
  }, []);

  useEffect(() => {
    if (!routeId || routeId === createdIdRef.current) return;
    setLoadingExisting(true);
    let cancelled = false;
    submissionService
      .get(routeId)
      .then((s) => {
        if (cancelled) return;
        if (!s.can_edit) {
          toast.info(`${s.reference_code} is ${s.status.replace("_", " ").toLowerCase()}. Withdraw it to make changes.`);
          navigate(`/submissions/${s.id}`, { replace: true });
          return;
        }
        applyServer(s);
        setContentType(s.content_type);
        setTitle(s.title === "Untitled submission" ? "" : s.title);
        setBrand(s.brand_code || "");
        setAccountId(s.account_id || "");
        setAudience(s.audience || "");
        setRegion(s.region || "Global");
        setPlatforms(s.platforms);
        setPublishDate(s.publish_at ? new Date(s.publish_at) : undefined);
        setRuleSets(s.rule_sets.length ? s.rule_sets : ["Public Company Disclosure"]);
        setReviewers(s.reviewer_route.length ? s.reviewer_route : ["Marketing Review", "Compliance Review"]);
        // The editor mounts after the loading state clears; the effect below fills it in.
        pendingCaptionHtml.current = s.caption_html || "";
        setCaption(s.caption_text || "");
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
      editorRef.current.innerHTML = pendingCaptionHtml.current;
      pendingCaptionHtml.current = null;
    }
  }, [loadingExisting]);

  // ----- Saving (S01, S02-S04, S06, S08) -----
  const buildPayload = (): SubmissionUpdate => {
    const clear: SubmissionUpdate["clear_fields"] = [];
    if (!publishDate) clear.push("publish_at");
    if (!accountId) clear.push("account_id");
    if (!brand) clear.push("brand_code");
    if (!audience) clear.push("audience");
    return {
      title: title.trim() || "Untitled submission",
      content_type: contentType,
      ...(brand ? { brand_code: brand } : {}),
      ...(audience ? { audience } : {}),
      ...(region ? { region } : {}),
      platforms,
      ...(accountId ? { account_id: accountId } : {}),
      ...(publishDate ? { publish_at: publishDate.toISOString() } : {}),
      caption_html: editorRef.current?.innerHTML || "",
      caption_text: editorRef.current?.innerText.trim() || "",
      rule_sets: ruleSets,
      reviewer_route: reviewers,
      clear_fields: clear,
    };
  };

  /** Create the draft if needed, then save the current fields. Calls are queued so they never overlap. */
  const save = (opts: { force?: boolean } = {}): Promise<string | null> => {
    const payload = buildPayload();
    const hasAnything = Boolean(title.trim() || payload.caption_text || brand || platforms.length || accountId);
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
    if (editCounter === 0) return;
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
  const suggestRouting = (next: { brand?: string; audience?: string; account?: AccountOption }) => {
    const rules = new Set(["Public Company Disclosure"]);
    const route = new Set(["Marketing Review", "Compliance Review"]);
    if (next.brand === "ZENATECH") rules.add("ZenaTech General");
    if (next.brand === "ZENADRONE" || next.audience === "DEFENSE") {
      rules.add("ZenaDrone Defense");
      route.add("Legal Review");
    }
    if (next.audience === "INVESTORS") route.add("Investor Relations Review");
    if (next.account?.is_ceo) {
      rules.add("Shaun CEO Thought Leadership");
      route.add("Legal Review");
      route.add("Executive Review");
    }
    setRuleSets((prev) => Array.from(new Set([...prev, ...rules])));
    setReviewers((prev) => Array.from(new Set([...prev, ...route])));
  };

  const onBrandChange = (code: string) => {
    setBrand(code);
    // Drop an account that belongs to a different brand.
    if (account?.brand_code && account.brand_code !== code) setAccountId("");
    suggestRouting({ brand: code, audience, account: account?.brand_code && account.brand_code !== code ? undefined : account });
    markEdited();
  };

  const onAccountChange = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    setAccountId(id);
    if (acc && !platforms.includes(acc.platform)) setPlatforms((prev) => [...prev, acc.platform]);
    suggestRouting({ brand, audience, account: acc });
    markEdited();
  };

  const onAudienceChange = (value: string) => {
    setAudience(value);
    suggestRouting({ brand, audience: value, account });
    markEdited();
  };

  // ----- Files (S05, S07) -----
  const uploadFiles = async (list: File[]) => {
    if (list.length === 0) return;

    let mainTaken = files.some((f) => f.kind === "MAIN");
    const batch: { file: File; kind: SubmissionFileKind; key: string }[] = [];
    for (const file of list) {
      const result = classifyFile(file, contentType, mainTaken);
      if ("error" in result) {
        toast.error(`${file.name}: ${result.error}`);
        continue;
      }
      if (result.kind === "MAIN") mainTaken = true;
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
        const saved = await submissionService.uploadFile(id, kind, file);
        setFiles((prev) => [...prev, saved]);
      } catch (err) {
        toast.error(`${file.name}: ${(err as Error).message}`);
      } finally {
        setUploading((prev) => prev.filter((u) => u.key !== key));
      }
    }
    setServerMissing([]);
  };

  const removeFile = async (file: SubmissionFile) => {
    if (!submissionId) return;
    setRemovingId(file.id);
    try {
      await submissionService.removeFile(submissionId, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast.success(`Removed ${file.original_name}`);
    } catch (err) {
      toast.error(`Couldn't remove the file: ${(err as Error).message}`);
    } finally {
      setRemovingId(null);
    }
  };

  // ----- Initial check and submit (S09) -----
  const runCheck = async () => {
    if (!title.trim() && !caption.trim()) {
      toast.error("Add a title or caption before running the initial check.");
      return;
    }
    setChecking(true);
    try {
      const id = await save({ force: true });
      const s = await submissionService.runCheck(id!);
      setCheck(s.latest_check ?? null);
      if (s.latest_check?.is_compliant) toast.success("Initial check passed. No rule violations found.");
      else toast.warning(`${s.latest_check?.violations_count} potential issue(s) found. See the summary panel.`);
    } catch (err) {
      toast.error(`Initial check failed: ${(err as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  const mainFiles = files.filter((f) => f.kind === "MAIN");
  const clientMissing = {
    title: !title.trim(),
    brand_code: !brand,
    account_id: !accountId,
    audience: !audience,
    region: !region,
    platforms: platforms.length === 0,
    main_file: ["VIDEO", "IMAGE", "CAROUSEL"].includes(contentType) && mainFiles.length === 0,
    content: !["VIDEO", "IMAGE", "CAROUSEL"].includes(contentType) && mainFiles.length === 0 && !caption.trim(),
    rule_sets: ruleSets.length === 0,
    reviewer_route: reviewers.length === 0,
    // Checked on submit (and by the server); comparing to "now" during render isn't stable.
    publish_at: false,
  };
  const isMissing = (field: keyof typeof clientMissing) =>
    showErrors && (clientMissing[field] || serverMissing.includes(field));
  const errorFor = (field: keyof typeof clientMissing, text = "Required") => (isMissing(field) ? text : false);

  const submit = async () => {
    const missingNow = Object.entries(clientMissing).filter(([, v]) => v).map(([k]) => k);
    if (publishDate && publishDate.getTime() < Date.now()) {
      missingNow.push("publish_at");
      setServerMissing(["publish_at"]);
    }
    if (missingNow.length) {
      setShowErrors(true);
      toast.error(`Please add: ${missingNow.map((m) => MISSING_LABELS[m] || m).join(", ")}.`);
      return;
    }
    setSubmitting(true);
    try {
      const id = await save({ force: true });
      const result = await submissionService.submit(id!);
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
        `${result.submission.reference_code} submitted for review (version ${result.submission.current_version}). Automated check: ${result.review_job.score}/100.`
      );
      navigate(`/submissions/${result.submission.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.detail && typeof err.detail === "object" && "missing" in err.detail) {
        const missing = (err.detail as { missing: string[] }).missing;
        setServerMissing(missing);
        setShowErrors(true);
        toast.error(`Please add: ${missing.map((m) => MISSING_LABELS[m] || m).join(", ")}.`);
      } else {
        toast.error(`Couldn't submit: ${(err as Error).message}`);
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

  const insertHashtag = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && (!sel.rangeCount || !editor.contains(sel.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const text = editor.innerText || "";
    document.execCommand("insertText", false, `${text && !text.endsWith(" ") && !text.endsWith("\n") ? " " : ""}${tag} `);
    setCaption(editor.innerText || "");
    markEdited();
  };

  const charLimit = useMemo(() => {
    const limits = platforms.map((p) => CHAR_LIMITS[p]).filter((n): n is number => typeof n === "number");
    return limits.length ? Math.min(...limits) : 2200;
  }, [platforms]);

  const hashtagSuggestions = HASHTAGS[brand] || [...HASHTAGS.ZENATECH, ...HASHTAGS.ZENADRONE].slice(0, 6);

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
    <div className="w-full max-w-[1440px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title={referenceCode ? `Edit Submission ${referenceCode}` : "New Submission"}
        subtitle="Create a new content submission for compliance review and approval."
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5 items-start">
        {/* ---------------- Form ---------------- */}
        <div className="space-y-4 min-w-0">
          <Section step={1} title="Content Type" description="Select the type of content you want to submit.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="radiogroup">
              {CONTENT_TYPES.map(({ value, label, description, icon: Icon }) => {
                const selected = contentType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      if (value === contentType) return;
                      if (mainFiles.length > 0) {
                        toast.info("Your uploaded content file stays attached. Replace it if it doesn't match the new type.");
                      }
                      setContentType(value);
                      markEdited();
                    }}
                    className={`relative text-left rounded-xl border p-3.5 transition-all ${
                      selected ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/40" : "border-border/80 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <span
                      className={`absolute top-3 right-3 w-4 h-4 rounded-full border flex items-center justify-center ${
                        selected ? "border-blue-600" : "border-muted-foreground/40"
                      }`}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                    </span>
                    <span
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-2.5 ${
                        selected ? "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-background" : "border-border text-foreground"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <span className="block text-sm font-semibold text-foreground">{label}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section step={2} title="Submission Details" description="Provide key details about your content.">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-x-4 gap-y-3.5">
              <Field label="Title" required error={errorFor("title")} className="md:col-span-2 lg:col-span-3">
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markEdited();
                  }}
                  maxLength={300}
                  placeholder="e.g. ZenaDrone 1000 – Autonomous Defense Capabilities"
                  className={isMissing("title") ? "border-red-500" : ""}
                />
              </Field>
              <Field label="Brand" required error={errorFor("brand_code")} className="md:col-span-2 lg:col-span-3">
                <Select value={brand} onValueChange={onBrandChange} disabled={!options}>
                  <SelectTrigger className={`w-full ${isMissing("brand_code") ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={options ? "Select brand" : "Loading brands..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.brands.map((b) => (
                      <SelectItem key={b.code} value={b.code}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Publishing Account"
                required
                error={errorFor("account_id", "Choose a connected account")}
                className="lg:col-span-2"
              >
                <Select value={accountId} onValueChange={onAccountChange} disabled={!options || brandAccounts.length === 0}>
                  <SelectTrigger className={`w-full ${isMissing("account_id") ? "border-red-500" : ""}`}>
                    <SelectValue
                      placeholder={
                        !options ? "Loading accounts..." : brandAccounts.length === 0 ? "No connected accounts" : "Select account"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {brandAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <PlatformIcon platform={a.platform as SocialPlatform} className="w-4 h-4" />
                        {a.label}
                        {a.is_demo && <span className="text-[10px] text-muted-foreground ml-1">demo</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {options && brandAccounts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No connected accounts{brand ? ` for ${brandName}` : ""}. An admin can connect one under Integrations.
                  </p>
                )}
              </Field>
              <Field label="Target Audience" required error={errorFor("audience")} className="lg:col-span-2">
                <Select value={audience} onValueChange={onAudienceChange} disabled={!options}>
                  <SelectTrigger className={`w-full ${isMissing("audience") ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(options?.audiences ?? {}).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Region" required error={errorFor("region")} className="md:col-span-2 lg:col-span-2">
                <Select
                  value={region}
                  onValueChange={(v) => {
                    setRegion(v);
                    markEdited();
                  }}
                  disabled={!options}
                >
                  <SelectTrigger className="w-full">
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

              <Field label="Platform(s)" required error={errorFor("platforms")} className="md:col-span-2 lg:col-span-4">
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
              </Field>
              <Field
                label="Intended Publish Date"
                error={errorFor("publish_at", "Pick a date in the future")}
                className="md:col-span-2 lg:col-span-2"
              >
                <Popover>
                  <div
                    className={`flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 ${
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
            </div>
          </Section>

          <Section step={3} title="Upload Content" description="Upload your content and any supporting materials in one go.">
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
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingMain(true);
              }}
              onDragLeave={() => setIsDraggingMain(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingMain(false);
                if (e.dataTransfer.files) uploadFiles(Array.from(e.dataTransfer.files));
              }}
              className={`min-h-[190px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-1.5 p-6 cursor-pointer transition-colors ${
                isDraggingMain
                  ? "border-blue-500 bg-blue-500/10"
                  : isMissing("main_file") || isMissing("content")
                  ? "border-red-400 bg-red-500/5"
                  : "border-blue-300 dark:border-blue-500/40 bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <span className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">Drag & drop files here</span>
              <span className="text-xs text-muted-foreground max-w-md">
                Add {mainUpload.main}, plus any scripts, extra images or supporting documents. You can select several files at once.
              </span>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-2xs">
                <CloudUpload className="w-3.5 h-3.5" /> Choose Files
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                Video (MP4, MOV, AVI, WEBM up to 2 GB) · Images (JPG, PNG, WebP) · Documents (PDF, DOC, TXT, XLSX, ZIP)
              </span>
            </div>
            {isMissing("main_file") && (
              <p className="text-[11px] text-red-600 mt-1.5">
                Add {mainUpload.main} to submit this {CONTENT_TYPES.find((c) => c.value === contentType)?.label.toLowerCase()}.
              </p>
            )}
            {isMissing("content") && <p className="text-[11px] text-red-600 mt-1.5">Add a file or write the copy in section 4.</p>}

            {(files.length > 0 || uploading.length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Uploaded files <span className="font-normal text-muted-foreground">({files.length})</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {files.map((f) => (
                    <SubmissionFileRow key={f.id} file={f} removing={removingId === f.id} onRemove={() => removeFile(f)} />
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
          </Section>

          <Section step={4} title="Caption / Copy" description="Write or paste your caption, script, or copy.">
            <div className={`rounded-lg border ${isMissing("content") ? "border-red-500" : "border-input"} overflow-hidden`}>
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
                    const url = window.prompt("Link URL", "https://");
                    if (url) exec("createLink", url);
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                </Button>
                <span className="flex-1" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15">
                      <Hash className="w-3.5 h-3.5" /> Hashtags
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <p className="text-[11px] text-muted-foreground px-1 pb-1.5">Suggested for {brandName || "ZenaTech brands"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hashtagSuggestions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertHashtag(tag)}
                          className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
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
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Caption or copy"
                data-placeholder="Write your caption, script, or copy here..."
                onInput={(e) => {
                  setCaption(e.currentTarget.innerText);
                  markEdited();
                }}
                className="min-h-[96px] max-h-[320px] overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none bg-background empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-blue-600 [&_a]:underline"
              />
            </div>
            <p className={`text-[11px] text-right mt-1.5 ${caption.trim().length > charLimit ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
              {caption.trim().length.toLocaleString()}/{charLimit.toLocaleString()} characters
              {platforms.length > 0 && caption.trim().length > charLimit && " (too long for one of the selected platforms)"}
            </p>
          </Section>

          <Section step={5} title="Compliance & Routing" description="Select applicable rule sets and review route.">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3.5">
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
              <Field label="Reviewer Route" required error={errorFor("reviewer_route")}>
                <MultiSelect
                  options={options?.reviewer_routes ?? []}
                  value={reviewers}
                  onChange={(next) => {
                    setReviewers(next);
                    markEdited();
                  }}
                  placeholder="Select reviewers"
                  compact
                  invalid={isMissing("reviewer_route")}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Suggested automatically from the brand, audience and publishing account. You can add or remove any.
            </p>
          </Section>
        </div>

        {/* ---------------- Summary ---------------- */}
        <div className="space-y-3 xl:sticky xl:top-0">
          <Card className="py-0 gap-0 border-border/80 shadow-xs">
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
              <SummaryRow icon={Users} label="Account">
                {account ? (
                  <span className="inline-flex items-center gap-1.5">
                    <PlatformIcon platform={account.platform as SocialPlatform} className="w-4 h-4" />
                    {account.label}
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
            </div>

            <div className="px-4 pt-3 pb-4 border-t border-border/60 mt-1">
              <p className="text-xs font-semibold text-foreground mb-2">Content Files</p>
              {files.length === 0 && uploading.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3 text-center">No files uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {files.map((f) => (
                    <SubmissionFileRow key={f.id} file={f} removing={removingId === f.id} onRemove={() => removeFile(f)} />
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

            {(check || checking) && (
              <div className="px-4 pt-3 pb-4 border-t border-border/60">
                <p className="text-xs font-semibold text-foreground mb-2">Initial Check</p>
                {checking ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking against the rulebook...
                  </p>
                ) : check ? (
                  <CheckResult check={check} />
                ) : null}
              </div>
            )}
          </Card>

          {submissionId && (
            <Card className="py-0 px-4 pt-3 pb-4 gap-0 border-border/80 shadow-xs">
              <SentimentPanel submissionId={submissionId} />
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2 [&>button:last-child]:col-span-2 sm:[&>button:last-child]:col-span-1 xl:[&>button:last-child]:col-span-2">
            <Button type="button" variant="outline" onClick={saveNow} disabled={saveState === "saving"} className="gap-1.5 text-xs font-semibold">
              {saveState === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={runCheck}
              disabled={checking}
              className="gap-1.5 text-xs font-semibold border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10"
            >
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Run Initial Check
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || uploading.length > 0}
              className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Submit for Review
            </Button>
          </div>
          {optionsQuery.isError && (
            <p className="text-[11px] text-red-600">Couldn't load brands and accounts. Refresh to try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
