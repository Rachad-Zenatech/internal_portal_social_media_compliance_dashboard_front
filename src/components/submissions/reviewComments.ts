import type { ReviewComment, ReviewCommentCategory } from "@/types/submission";

export const COMMENT_CATEGORIES: { value: ReviewCommentCategory; label: string; tone: string }[] = [
  { value: "LEGAL", label: "Legal", tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  { value: "EDITORIAL", label: "Editorial", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "COMPLIANCE", label: "Compliance", tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  { value: "BRAND", label: "Brand", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { value: "NOTE", label: "Note", tone: "bg-muted text-muted-foreground" },
];
export const toneFor = (c: string) => COMMENT_CATEGORIES.find((x) => x.value === c)?.tone ?? "bg-muted text-muted-foreground";
export const labelFor = (c: string) => COMMENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** The numbers shown on image boxes and beside their comments, in the order the comments were written. */
export const regionNumbers = (comments: ReviewComment[]): Map<string, number> =>
  new Map(comments.filter((c) => c.file_id && c.region_w != null).map((c, i) => [c.id, i + 1] as const));

export const formatSec = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** The id of a post's comment box, so a Reply can put the cursor in it wherever the page shows it. */
export const commentBoxId = (submissionId: string) => `comment-box-${submissionId}`;
