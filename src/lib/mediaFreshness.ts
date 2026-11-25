import type { StoredCheck, Submission, SubmissionFile } from "@/types/submission";

/** Supporting documents and extraction updates do not replace the post's media. */
export function mediaKey(files: SubmissionFile[]): string {
  return files.filter((file) => ["MAIN", "IMAGE", "SCRIPT"].includes(file.kind))
    .map((file) => file.id).sort().join(",");
}

export function analysisIsCurrent(completedAt?: string | null, mediaEditedAt?: string | null, validatedAt?: string | null): boolean {
  if (validatedAt != null) return Boolean(completedAt && mediaEditedAt) && Date.parse(validatedAt) === Date.parse(mediaEditedAt!);
  return Boolean(completedAt) && (!mediaEditedAt || Date.parse(completedAt!) >= Date.parse(mediaEditedAt));
}

export function mediaChanged(files: SubmissionFile[], saved?: Submission | null): boolean {
  return Boolean(saved && mediaKey(files) !== mediaKey(saved.files));
}

export function checkIsCurrent(check?: StoredCheck | null, mediaEditedAt?: string | null): boolean {
  if (!check) return false;
  if ("checked_media_edited_at" in check) {
    const checked = check.checked_media_edited_at;
    return checked && mediaEditedAt ? Date.parse(checked) === Date.parse(mediaEditedAt) : !checked && !mediaEditedAt;
  }
  return !mediaEditedAt || analysisIsCurrent(check.checked_at, mediaEditedAt);
}
