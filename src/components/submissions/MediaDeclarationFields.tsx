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
  const save = (fields: SubmissionUpdate) => {
    if (submissionId) void submissionService.update(submissionId, fields).then(onRefresh)
      .catch((error: Error) => toast.error(`Couldn't save the answer: ${error.message}`));
  };
  const onPeople = (answer: boolean) => save({ people_in_images: answer });
  const onEmployee = (answer: boolean) => save({ employee_in_images: answer });
  const onFace = (key: string, answer: boolean) => save({ face_employee_flags: { ...(post?.face_employee_flags || {}), [key]: answer } });
  return (
    <>
      <ImageProvenanceField files={files} {...image} disabled={disabled} />
      {image.value !== true && <ImagePersonField files={files} value={post?.people_in_images_confirmed ? Boolean(post.people_in_images) : null} employeeValue={post?.employee_in_images_confirmed ? Boolean(post.employee_in_images) : null} faceFlags={post?.face_employee_flags} faceAutoMatched={post?.face_auto_matched} faceSamePerson={post?.face_same_person} detected={post?.people_in_images_detected} disabled={disabled} submissionId={submissionId} onRefresh={onRefresh} onChange={onPeople} onEmployeeChange={onEmployee} onFaceFlagChange={onFace} />}
      <VideoFootageField {...video} disabled={disabled} />
    </>
  );
}
