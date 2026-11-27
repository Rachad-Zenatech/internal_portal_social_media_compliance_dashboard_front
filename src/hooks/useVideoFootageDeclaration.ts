import { useState } from "react";
import type { Submission, SubmissionFile } from "@/types/submission";

/** Keep an unsaved answer while polling, and send an explicit false as well as true. */
export function useVideoFootageDeclaration(post: Submission | null, files: SubmissionFile[]) {
  const [selection, setSelection] = useState<{ id: string; value: boolean }>();
  const value = selection && selection.id === post?.id ? selection.value : post?.video_third_party_footage ?? null;
  const enabled = files.some(file => file.kind === "MAIN" && file.mime_type.startsWith("video/"));
  const onChange = (value: boolean) => { if (post) setSelection({ id: post.id, value }); };
  const payload = value == null ? {} : { video_third_party_footage: value };
  const changed = value !== (post?.video_third_party_footage ?? null);
  return { value, enabled, onChange, payload, changed, missing: enabled && value == null };
}
