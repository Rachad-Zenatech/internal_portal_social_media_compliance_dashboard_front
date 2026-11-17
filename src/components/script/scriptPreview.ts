import type { ScriptVersion } from "@/types/script";
import type { SubmissionFile } from "@/types/submission";

/** Prefer the attached script's extracted text, with the latest reviewed version as fallback. */
export function scriptTextOf(files: SubmissionFile[], versions: ScriptVersion[] = []) {
  const uploaded = files.find((file) => file.kind === "SCRIPT")?.doc_text;
  if (uploaded) return uploaded;
  return [...versions].sort((a, b) => b.version_number - a.version_number)[0]?.body || "";
}
