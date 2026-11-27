import { Video, MessageSquareText, GalleryHorizontalEnd, Image as ImageIcon, FileText, Megaphone, type LucideIcon } from "lucide-react";
import type { ContentType, SubmissionFileKind } from "@/types/submission";

// Static presentation config (allowed values themselves come from the API)
export const CONTENT_TYPES: { value: ContentType; label: string; description: string; icon: LucideIcon }[] = [
  { value: "IMAGE", label: "Image", description: "Single image with text and sources", icon: ImageIcon },
  { value: "VIDEO", label: "Video", description: "TikTok, YouTube, LinkedIn, etc.", icon: Video },
  { value: "SOCIAL_POST", label: "Social Post", description: "Single image social post", icon: MessageSquareText },
  { value: "TEXT_POST", label: "Text Post", description: "Post text and source links, without images or video", icon: FileText },
  { value: "CAROUSEL", label: "Carousel", description: "Multi-image post", icon: GalleryHorizontalEnd },
  { value: "BLOG", label: "Blog / Article", description: "Long-form content", icon: FileText },
  { value: "AD", label: "Paid Ad", description: "Sponsored post or ad creative", icon: Megaphone },
];
export const VISIBLE_CONTENT_TYPES = CONTENT_TYPES.filter(({ value }) => value !== "SOCIAL_POST" && value !== "BLOG" && value !== "AD");

export const MAIN_UPLOAD: Record<ContentType, { main: string }> = {
  VIDEO: { main: "your video" },
  TEXT_POST: { main: "post text" },
  SOCIAL_POST: { main: "your image or video" },
  CAROUSEL: { main: "your carousel images" },
  IMAGE: { main: "your image" },
  BLOG: { main: "your article" },
  AD: { main: "your ad creative (image or video)" },
};
/** Types whose main file is required: there's nothing to review without it. */
export const MAIN_REQUIRED: ContentType[] = ["VIDEO", "IMAGE", "CAROUSEL", "AD"];
/** Selected automatically with the Paid Ad type. */
export const ADS_RULE_SET = "Paid Social Ads";

const IMAGE_UPLOAD_FORMATS = "Images (JPG, PNG, WebP) · Documents (PDF, DOC, TXT, XLSX, ZIP)";
const VIDEO_UPLOAD_FORMATS = "Video (MP4, MOV, AVI, WEBM up to 2 GB) · " + IMAGE_UPLOAD_FORMATS;
export const UPLOAD_FORMAT_HINTS: Record<ContentType, string> = {
  IMAGE: IMAGE_UPLOAD_FORMATS, CAROUSEL: IMAGE_UPLOAD_FORMATS,
  VIDEO: VIDEO_UPLOAD_FORMATS, SOCIAL_POST: VIDEO_UPLOAD_FORMATS, AD: VIDEO_UPLOAD_FORMATS,
  BLOG: "Documents (PDF, DOC, DOCX, TXT, MD)", TEXT_POST: "Post text and source links",
};

export const ACCEPT_ALL = "video/*,image/*,.mp4,.mov,.avi,.webm,.mkv,.m4v,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.zip,.ppt,.pptx";
const VIDEO_RE = /\.(mp4|mov|avi|webm|mkv|m4v)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
const ARTICLE_RE = /\.(pdf|docx?|md|txt)$/i;
const DOC_RE = /\.(pdf|docx?|md|txt|xlsx?|csv|zip|pptx?)$/i;
/** Files the check can read as a script. */
export const SCRIPT_RE = /\.(pdf|docx?|md|txt)$/i;
export const ACCEPT_SCRIPT = ".pdf,.docx,.doc,.txt,.md";

/**
 * Decide what each dropped file is: the main content asset, an extra image, or a supporting document.
 * Returns null with a reason for files this submission can't take.
 */
export function classifyFile(
  file: File,
  type: ContentType,
  mainTaken: boolean,
  scriptTaken = false
): { kind: SubmissionFileKind } | { error: string } {
  if (type === "TEXT_POST") return { error: "Text posts use only post text and source links." };
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
        : "Choose Video to upload a video.",
    };
  }
  if (isImage) return { kind: "IMAGE" };
  // Only video posts use scripts; documents on other post types are supporting evidence.
  if (type === "VIDEO" && SCRIPT_RE.test(name) && !scriptTaken && /script/i.test(name)) return { kind: "SCRIPT" };
  if (DOC_RE.test(name)) return { kind: "SUPPORTING" };
  return { error: "this file type isn't supported." };
}

export const CONTENT_TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  VIDEO: { label: "Video", cls: "bg-muted text-muted-foreground" },
  TEXT_POST: { label: "Text Post", cls: "bg-muted text-muted-foreground" },
  SOCIAL_POST: { label: "Post", cls: "bg-muted text-muted-foreground" },
  CAROUSEL: { label: "Carousel", cls: "bg-muted text-muted-foreground" },
  IMAGE: { label: "Image", cls: "bg-muted text-muted-foreground" },
  BLOG: { label: "Article", cls: "bg-muted text-muted-foreground" },
  AD: { label: "Paid Ad", cls: "bg-muted text-muted-foreground" },
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  VIDEO: "Video",
  TEXT_POST: "Text Post", SOCIAL_POST: "Post",
  CAROUSEL: "Carousel",
  IMAGE: "Image",
  BLOG: "Article",
};


export const EDITOR_COPY = {
  TEXT_POST: {
    title: "Text", noun: "text",
    description: "Required. Write or paste your text, or have text suggested for your post.",
    placeholder: "Write your text here...", suggest: "Suggest text",
    missing: "Add text. The compliance check uses this text.",
  },
  DEFAULT: {
    title: "Text", noun: "text",
    description: "Required. Write or paste your text, or have text suggested for your post.",
    placeholder: "Write your text here...", suggest: "Suggest text",
    missing: "Add text. Compliance and sentiment analysis use this text.",
  },
} as const;
