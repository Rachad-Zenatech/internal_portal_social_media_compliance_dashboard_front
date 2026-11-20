import { useEffect, useId, useMemo, useState } from "react";
import { hasPostImages } from "@/lib/imageProvenance";
import { submissionService } from "@/services/submissionService";
import type { Submission, SubmissionFile } from "@/types/submission";

export default function ImagePersonField({ files, value, employeeValue, detected, disabled, submissionId, onRefresh, onChange, onEmployeeChange }: {
  files: SubmissionFile[];
  value: boolean | null;
  employeeValue: boolean | null;
  detected?: boolean | null;
  disabled: boolean;
  submissionId: string | null;
  onRefresh: (submission: Submission) => void;
  onChange: (answer: boolean) => void;
  onEmployeeChange: (answer: boolean) => void;
}) {
  const id = useId();
  const [selectedFace, setSelectedFace] = useState("");
  const [retrying, setRetrying] = useState(false);
  const faces = useMemo(() => files.flatMap((file) => (file.face_boxes || []).map((box, index) => ({ file, box, index }))), [files]);
  const selected = faces.find(({ file, index }) => `${file.id}-${index}` === selectedFace);
  const imageFiles = files.filter((file) => file.mime_type.startsWith("image/"));
  const failedFiles = imageFiles.filter((file) => file.image_text_status === "FAILED");
  const pending = imageFiles.some((file) => file.image_text_status == null || file.image_text_status === "PROCESSING" || (file.face_detection_version || 0) < 1);
  useEffect(() => {
    if (selectedFace && !faces.some(({ file, index }) => `${file.id}-${index}` === selectedFace)) {
      setSelectedFace("");
    }
  }, [faces, selectedFace]);
  useEffect(() => {
    if (!submissionId || !pending) return;
    const timer = window.setInterval(() => { void submissionService.get(submissionId).then(onRefresh).catch(() => undefined); }, 4000);
    return () => window.clearInterval(timer);
  }, [onRefresh, pending, submissionId]);
  if (!hasPostImages(files)) return null;
  const retry = async () => {
    if (!submissionId || retrying) return;
    setRetrying(true);
    try {
      await Promise.all(imageFiles.map((file) => submissionService.retryImageRead(submissionId, file.id)));
      onRefresh(await submissionService.get(submissionId));
    } finally { setRetrying(false); }
  };
  const detection = failedFiles.length ? `Face detection could not finish for ${failedFiles.length} image${failedFiles.length === 1 ? "" : "s"}. Retry it, then confirm the result.` : detected == null ? "We are reading the uploaded image(s); please confirm the result when ready." : detected ? "We found a person in an uploaded image. Confirm or correct this result." : "We did not find a person in the uploaded image(s). Confirm or correct this result.";
  return (
    <fieldset disabled={disabled} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold text-foreground">Does this post show a person?</legend>
      <p className="text-xs text-muted-foreground">{detection}</p>
      {(pending || failedFiles.length > 0) && <button type="button" onClick={() => void retry()} disabled={retrying || disabled} className="w-fit text-xs font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{retrying ? "Retrying face detection…" : "Retry face detection"}</button>}
      {faces.length > 0 && <label className="block text-xs font-medium text-foreground">Detected faces ({faces.length})<select value={selectedFace} onChange={(event) => setSelectedFace(event.target.value)} className="mt-1 block h-8 w-full rounded-md border border-border bg-background px-2 text-xs"><option value="">Choose a face to review</option>{faces.map(({ file, index }, faceIndex) => <option key={`${file.id}-${index}`} value={`${file.id}-${index}`}>Face {faceIndex + 1} — {file.original_name}</option>)}</select></label>}
      {selected && <div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="size-12 overflow-hidden rounded-md border border-border bg-muted"><img src={selected.file.url} alt="Detected face preview" className="size-full object-cover" style={{ objectPosition: `${(selected.box[1] + selected.box[3]) / 20}% ${(selected.box[0] + selected.box[2]) / 20}%` }} /></div><span>Face {faces.indexOf(selected) + 1} preview</span></div>}
      <div className="flex flex-wrap gap-2">
        {[true, false].map((answer) => <label key={String(answer)} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={id} checked={value === answer} onChange={() => onChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}
      </div>
      {(value === true || detected === true) && <div className="border-t border-border/70 pt-2"><p className="text-xs font-medium text-foreground">Is any person shown an employee?</p><div className="mt-1.5 flex flex-wrap gap-2">{[true, false].map((answer) => <label key={`employee-${String(answer)}`} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={`${id}-employee`} checked={employeeValue === answer} onChange={() => onEmployeeChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}</div></div>}
    </fieldset>
  );
}
