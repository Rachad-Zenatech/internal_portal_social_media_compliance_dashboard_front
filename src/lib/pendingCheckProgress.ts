import type { StoredCheck, SubmissionFile } from "@/types/submission";

const finished = (status?: string | null) => status === "COMPLETED" || status === "FAILED";

/** Saved pending counts describe the earlier check; current file states describe the work still running. */
export function pendingCheckProgress(check: Pick<StoredCheck, "images_pending" | "documents_pending" | "transcript_pending">, files: SubmissionFile[]) {
  const images = files.filter(f => ["MAIN", "IMAGE"].includes(f.kind) && f.mime_type.startsWith("image/"));
  const video = files.filter(f => f.kind === "MAIN" && f.mime_type.startsWith("video/"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const documents = files.filter(f => ["MAIN", "SCRIPT"].includes(f.kind) && /\.(txt|md|docx|pdf|doc)$/i.test(f.original_name));
  const imagesReading = (check.images_pending ?? 0) > 0 && (!images.length || images.some(f => !finished(f.image_text_status)));
  const videoReading = Boolean(check.transcript_pending && (!video || !finished(video.transcript_status)));
  const documentsReading = (check.documents_pending ?? 0) > 0 && (!documents.length || documents.some(f => !finished(f.doc_text_status)));
  if (!imagesReading && !videoReading && !documentsReading) {
    return { label: "Finishing compliance check", description: "Media reading has finished. Updating the compliance result." };
  }
  const label = imagesReading && videoReading ? "Processing video and images"
    : imagesReading ? "Processing images" : videoReading ? "Processing video" : "Reading documents";
  return { label, description: "Your compliance score will appear when processing finishes." };
}
