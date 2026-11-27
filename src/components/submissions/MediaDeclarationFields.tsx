import { useEffect, useState } from "react";
import { toast } from "sonner";
import ImageProvenanceField from "./ImageProvenanceField";
import ImagePersonField from "./ImagePersonField";
import VideoFootageField from "./VideoFootageField";
import { submissionService } from "@/services/submissionService";
import type { Submission, SubmissionFile, SubmissionUpdate } from "@/types/submission";
import type { useVideoFootageDeclaration } from "@/hooks/useVideoFootageDeclaration";

interface Props {
  files: SubmissionFile[];
  image: { value: boolean | null; invalid: boolean; onChange: (answer: boolean) => void };
  video: ReturnType<typeof useVideoFootageDeclaration> & { invalid: boolean };
  post: Submission | null;
  disabled: boolean;
  submissionId: string | null;
  onRefresh: (post: Submission) => void;
}

/** Image/person and mixed-video declarations share the media details area. */
export default function MediaDeclarationFields({ files, image, video, post, disabled, submissionId, onRefresh }: Props) {
  const [pendingFlags, setPendingFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const saved = post?.face_employee_flags;
    if (!saved) return;
    setPendingFlags((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        if (saved[k] === v) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [post?.face_employee_flags]);
  const save = (fields: SubmissionUpdate) => {
    if (submissionId) void submissionService.update(submissionId, fields).then(onRefresh)
      .catch((error: Error) => {
        setPendingFlags({});
        toast.error(`Couldn't save the answer: ${error.message}`);
      });
  };
  const onPeople = (answer: boolean) => save({ people_in_images: answer });
  const onEmployee = (answer: boolean) => save({ employee_in_images: answer });
  const currentFlags = { ...(post?.face_employee_flags || {}), ...pendingFlags };
  const onFace = (key: string, answer: boolean) => {
    const next = { ...currentFlags, [key]: answer };
    setPendingFlags((prev) => ({ ...prev, [key]: answer }));
    save({ face_employee_flags: next });
  };
  return (
    <>
      <ImageProvenanceField files={files} {...image} disabled={disabled} />
      {image.value !== true && <ImagePersonField files={files} value={post?.people_in_images_confirmed ? Boolean(post.people_in_images) : null} employeeValue={post?.employee_in_images_confirmed ? Boolean(post.employee_in_images) : null} faceFlags={currentFlags} faceAutoMatched={post?.face_auto_matched} faceSamePerson={post?.face_same_person} detected={post?.people_in_images_detected} disabled={disabled} submissionId={submissionId} onRefresh={onRefresh} onChange={onPeople} onEmployeeChange={onEmployee} onFaceFlagChange={onFace} />}
      <VideoFootageField {...video} disabled={disabled} />
    </>
  );
}
