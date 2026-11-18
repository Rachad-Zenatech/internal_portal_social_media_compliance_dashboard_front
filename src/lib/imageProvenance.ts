import type { Submission, SubmissionFile } from "@/types/submission";

export function hasPostImages(files: SubmissionFile[]): boolean {
  return files.some((file) => ["MAIN", "IMAGE"].includes(file.kind) && file.mime_type.startsWith("image/"));
}

export function imageProvenanceAnswer(submission: Pick<Submission, "ai_generated_images" | "ai_generated_images_confirmed">): boolean | null {
  return submission.ai_generated_images_confirmed || submission.ai_generated_images === true ? Boolean(submission.ai_generated_images) : null;
}

export function imageProvenancePayload(answer: boolean | null): { ai_generated_images?: boolean } {
  return answer == null ? {} : { ai_generated_images: answer };
}
