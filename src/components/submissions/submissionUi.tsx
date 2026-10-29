import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { withLinkToken } from "@/lib/linkToken";
import { useVideoThumbnail } from "@/lib/videoThumbnail";
import type { DueKind } from "@/types/submission";
import {
  FileArchive,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Hourglass,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoredCheck, SubmissionFile, SubmissionStatus } from "@/types/submission";

/** Whether the post is still being read (video transcript, text in images): no score is shown until it has. */
export const isAnalysing = (check?: StoredCheck | null) =>
  Boolean(check && (check.analysis_pending ?? (check.transcript_pending || (check.images_pending ?? 0) > 0)));

/** Shown in place of a score while the post is still being analysed. */
export function UnderReviewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 ${className}`}
      title="Still reading the video and images; the score appears once the whole post has been analysed"
    >
      <Hourglass className="w-3 h-3" /> Under review
    </span>
  );
}

export const FILE_KIND_LABELS: Record<string, string> = {
  MAIN: "Main content",
  SCRIPT: "Script",
  IMAGE: "Image",
  SUPPORTING: "Supporting document",
};

/** How the submit endpoint's `missing` field names read in messages. */
export const MISSING_LABELS: Record<string, string> = {
  title: "title",
  brand_code: "brand",
  audience: "target audience",
  region: "region",
  platforms: "platform",
  account_id: "connected publishing account",
  rule_sets: "rule set",
  reviewer_route: "reviewer route",
  main_file: "main content file",
  content: "content file or caption",
  caption: "caption",
  publish_at: "a publish date in the future",
  approval_needed_by: "a \"need approval by\" date in the future",
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * URL a <video>/<img> can load directly. Media elements can't send the Authorization header, so the URL carries a
 * link token: it only opens media, and never the sign-in token itself (see lib/linkToken).
 */
export function authedFileUrl(url: string) {
  return withLinkToken(url);
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-foreground border-border" },
  IN_REVIEW: { label: "In review", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  CHANGES_REQUESTED: { label: "Changes requested", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  APPROVED: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  REJECTED: { label: "Rejected", className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus | string }) {
  const style = STATUS_STYLES[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold ${style.className}`}>
      {style.label}
    </Badge>
  );
}

const hoursUntil = (d: Date) => (d.getTime() - Date.now()) / 3_600_000;

/** "Review due in 5 hours" / "Changes overdue by 2 hours", with how urgent it is. */
export function dueInfo(dueAt?: string | null, kind?: DueKind | null) {
  if (!dueAt || !kind) return null;
  const due = new Date(dueAt);
  const what = kind === "REVIEW" ? "Review" : "Changes";
  const overdue = isPast(due);
  return {
    due,
    overdue,
    soon: !overdue && hoursUntil(due) <= 4,
    text: overdue ? `${what} overdue by ${formatDistanceToNowStrict(due)}` : `${what} due in ${formatDistanceToNowStrict(due)}`,
    exact: format(due, "EEE MMM d, h:mm a"),
  };
}

/** Deadline for the next step: red when overdue, amber when it's close. */
export function DueBadge({ dueAt, kind, className = "" }: { dueAt?: string | null; kind?: DueKind | null; className?: string }) {
  const info = dueInfo(dueAt, kind);
  if (!info) return null;
  const tone = info.overdue
    ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
    : info.soon
    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
    : "border-border bg-muted/50 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tone} ${className}`}
      title={`Due ${info.exact}`}
    >
      <Clock className="w-3 h-3" /> {info.text}
    </span>
  );
}

/** Thumbnail, name and size for a stored file, with optional remove action. */
/** Files whose text the backend reads into the check: the script, and a blog's article file (see document_text_service). */
function isReadDocument(file: SubmissionFile) {
  return (file.kind === "SCRIPT" || file.kind === "MAIN") && /\.(txt|md|docx?|pdf)$/i.test(file.original_name);
}

export function SubmissionFileRow({
  file,
  onRemove,
  removing,
}: {
  file: SubmissionFile;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const isVideo = file.mime_type.startsWith("video/");
  const isImage = file.mime_type.startsWith("image/");
  const src = authedFileUrl(file.url);
  // Most representative frame rather than the first one, which is often black.
  const { dataUrl: videoThumb, duration } = useVideoThumbnail(isVideo ? src : null);
  const DocIcon = /\.(zip|rar|7z)$/i.test(file.original_name)
    ? FileArchive
    : /\.(xlsx?|csv)$/i.test(file.original_name)
    ? FileSpreadsheet
    : FileText;

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-border/70 bg-card p-2 ${removing ? "opacity-50" : ""}`}>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        title="Open preview"
        className={`${isVideo ? "w-20 h-12" : "w-10 h-10"} rounded-md overflow-hidden bg-muted flex items-center justify-center shrink-0`}
      >
        {isVideo ? (
          videoThumb ? (
            <img src={videoThumb} alt="" className="w-full h-full object-cover" />
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )
        ) : isImage ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <DocIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        )}
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {FILE_KIND_LABELS[file.kind]} · {formatBytes(file.size_bytes)}
          {duration && Number.isFinite(duration) ? ` · ${formatDuration(duration)}` : ""}
          {isReadDocument(file) && file.doc_text_status === "COMPLETED" && " · Text read for the check"}
        </p>
        {isReadDocument(file) && (file.doc_text_status == null || file.doc_text_status === "PROCESSING") && (
          <p className="flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300">
            <Loader2 className="w-3 h-3 animate-spin" /> Reading the text for the check...
          </p>
        )}
        {isReadDocument(file) && file.doc_text_status === "FAILED" && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300" title={file.doc_text_error ?? undefined}>
            Not checked: {file.doc_text_error ?? "the text couldn't be read."}
          </p>
        )}
      </div>
      {removing ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="File options">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="text-xs gap-2">
            <a href={src} target="_blank" rel="noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Open preview
            </a>
          </DropdownMenuItem>
          {onRemove && (
            <DropdownMenuItem variant="destructive" onClick={onRemove} className="text-xs gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Remove file
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
