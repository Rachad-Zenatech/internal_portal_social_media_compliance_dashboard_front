import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { hasPostImages } from "@/lib/imageProvenance";
import { submissionService } from "@/services/submissionService";
import type { Submission, SubmissionFile } from "@/types/submission";

function FaceCropPreview({ url, box, size = 128 }: { url: string; box: number[]; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
      const [top = 0, left = 0, bottom = 1000, right = 1000] = box;
      const x = (left / 1000) * img.naturalWidth;
      const y = (top / 1000) * img.naturalHeight;
      const w = ((right - left) / 1000) * img.naturalWidth;
      const h = ((bottom - top) / 1000) * img.naturalHeight;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const side = Math.min(Math.max(w, h, 1), Math.min(img.naturalWidth, img.naturalHeight));
      const sx = Math.max(0, Math.min(img.naturalWidth - side, cx - side / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - side, cy - side / 2));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
      const scale = canvas.width / side;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 4;
      ctx.strokeRect(Math.max(2, (x - sx) * scale), Math.max(2, (y - sy) * scale), Math.min(canvas.width - 4, w * scale), Math.min(canvas.height - 4, h * scale));
    };
    img.src = authedFileUrl(url);
    return () => { cancelled = true; };
  }, [box, url]);
  return <canvas ref={canvasRef} width={size} height={size} aria-label="Detected face preview" className="size-full" />;
}

export default function ImagePersonField({ files, value, employeeValue, faceFlags, detected, disabled, submissionId, onRefresh, onChange, onEmployeeChange, onFaceFlagChange }: {
  files: SubmissionFile[];
  value: boolean | null;
  employeeValue: boolean | null;
  faceFlags?: Record<string, boolean>;
  detected?: boolean | null;
  disabled: boolean;
  submissionId: string | null;
  onRefresh: (submission: Submission) => void;
  onChange: (answer: boolean) => void;
  onEmployeeChange: (answer: boolean) => void;
  onFaceFlagChange?: (faceKey: string, answer: boolean) => void;
}) {
  const id = useId();
  const [retrying, setRetrying] = useState(false);
  const [zoomedFace, setZoomedFace] = useState<{ file: SubmissionFile; box: number[]; faceIndex: number } | null>(null);
  const faces = useMemo(() => files.flatMap((file) => (file.face_boxes || []).map((box, index) => ({ key: `${file.id}-${index}`, file, box }))), [files]);
  const imageFiles = files.filter((file) => file.mime_type.startsWith("image/"));
  const failedFiles = imageFiles.filter((file) => file.image_text_status === "FAILED");
  const pending = imageFiles.some((file) => file.image_text_status == null || file.image_text_status === "PROCESSING" || (file.face_detection_version || 0) < 1);
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
  const showPeople = value === true || (value == null && detected === true);
  const detection = failedFiles.length ? `Face detection could not finish for ${failedFiles.length} image${failedFiles.length === 1 ? "" : "s"}. Retry it, then confirm the result.` : detected == null ? "We are reading the uploaded image(s); please confirm the result when ready." : detected ? "We found a person in an uploaded image. Confirm or correct this result." : "We did not find a person in the uploaded image(s). Confirm or correct this result.";
  return (
    <fieldset disabled={disabled} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold text-foreground">Does this post show a person?</legend>
      <p className="text-xs text-muted-foreground">{detection}</p>
      {(pending || failedFiles.length > 0) && <button type="button" onClick={() => void retry()} disabled={retrying || disabled} className="w-fit text-xs font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{retrying ? "Retrying face detection…" : "Retry face detection"}</button>}
      <div className="flex flex-wrap gap-2">
        {[true, false].map((answer) => <label key={String(answer)} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={id} checked={value === answer} onChange={() => onChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}
      </div>
      {showPeople && faces.length > 0 && (
        <div className="space-y-2 border-t border-border/70 pt-2">
          <p className="text-xs font-medium text-foreground">Detected people ({faces.length}) — mark whether each person is an employee:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {faces.map(({ key, file, box }, faceIndex) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background p-2">
                <button type="button" onClick={() => setZoomedFace({ file, box, faceIndex })} title="Click to enlarge face" className="size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-border bg-muted"><FaceCropPreview url={file.url} box={box} /></button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs font-medium text-foreground">Person {faceIndex + 1} · {file.original_name}</p>
                  <p className="text-[11px] text-muted-foreground">Employee?</p>
                  <div className="flex gap-1.5">{[true, false].map((answer) => <label key={`${key}-${String(answer)}`} className="flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={`${id}-emp-${key}`} checked={faceFlags?.[key] === answer} onChange={() => onFaceFlagChange?.(key, answer)} className="size-3 accent-primary" />{answer ? "Yes" : "No"}</label>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showPeople && faces.length === 0 && <div className="border-t border-border/70 pt-2"><p className="text-xs font-medium text-foreground">Is any person shown an employee?</p><div className="mt-1.5 flex flex-wrap gap-2">{[true, false].map((answer) => <label key={`employee-${String(answer)}`} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={`${id}-employee`} checked={employeeValue === answer} onChange={() => onEmployeeChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}</div></div>}
      <Dialog open={Boolean(zoomedFace)} onOpenChange={(open) => { if (!open) setZoomedFace(null); }}>
        <DialogContent className="sm:max-w-md">
          {zoomedFace && (
            <>
              <DialogTitle className="text-sm font-medium">Person {zoomedFace.faceIndex + 1} · {zoomedFace.file.original_name}</DialogTitle>
              <div className="mx-auto size-72 max-w-full overflow-hidden rounded-xl border border-border bg-muted"><FaceCropPreview url={zoomedFace.file.url} box={zoomedFace.box} size={384} /></div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
