import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
      const side = Math.min(Math.max(w, h, 1) * 1.35, Math.min(img.naturalWidth, img.naturalHeight));
      const sx = Math.max(0, Math.min(img.naturalWidth - side, cx - side / 2));
      const sy = Math.max(0, Math.min(img.naturalHeight - side, cy - side / 2));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    };
    img.src = authedFileUrl(url);
    return () => { cancelled = true; };
  }, [box, url]);
  return <canvas ref={canvasRef} width={size} height={size} aria-label="Detected face preview" className="size-full" />;
}

export default function ImagePersonField({ files, value: _value, employeeValue, faceFlags, faceAutoMatched, faceSamePerson, detected, disabled, submissionId, onRefresh, onChange: _onChange, onEmployeeChange, onFaceFlagChange }: {
  files: SubmissionFile[];
  value?: boolean | null;
  employeeValue: boolean | null;
  faceFlags?: Record<string, boolean>;
  faceAutoMatched?: Record<string, number>;
  faceSamePerson?: Record<string, string[]>;
  detected?: boolean | null;
  disabled: boolean;
  submissionId: string | null;
  onRefresh: (submission: Submission) => void;
  onChange?: (answer: boolean) => void;
  onEmployeeChange: (answer: boolean) => void;
  onFaceFlagChange?: (faceKey: string, answer: boolean) => void;
}) {
  const id = useId();
  const [retrying, setRetrying] = useState(false);
  const [zoomedFace, setZoomedFace] = useState<{ file: SubmissionFile; box: number[]; faceIndex: number } | null>(null);
  const faces = useMemo(() => files.flatMap((file) => (file.face_boxes || []).map((box, index) => ({ key: `${file.id}-${index}`, file, box }))), [files]);
  const imageFiles = files.filter((file) => ["MAIN", "IMAGE"].includes(file.kind) && file.mime_type.startsWith("image/"));
  const failedFiles = imageFiles.filter((file) => file.image_text_status === "FAILED");
  const pending = imageFiles.some((file) => file.image_text_status == null || file.image_text_status === "PROCESSING" || (file.face_detection_version || 0) < 1);
  useEffect(() => {
    if (!submissionId || !pending) return;
    const timer = window.setInterval(() => { void submissionService.get(submissionId).then(onRefresh).catch(() => undefined); }, 2000);
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
  const scanning = retrying || pending;
  const doneCount = imageFiles.filter((file) => !retrying && file.image_text_status != null && file.image_text_status !== "PROCESSING" && (file.face_detection_version || 0) >= 1).length;
  const statusText = !scanning && failedFiles.length ? `Face detection could not finish for ${failedFiles.length} image${failedFiles.length === 1 ? "" : "s"}.` : !scanning && faces.length === 0 && detected === false ? "No people detected in the uploaded image(s)." : null;
  return (
    <fieldset disabled={disabled} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold text-foreground">People in images</legend>
      {scanning ? (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
            <span>
              {retrying
                ? "Restarting face detection scan…"
                : `Scanning uploaded image(s) for faces (${doneCount}/${imageFiles.length} complete)…`}
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
            <div className="absolute inset-y-0 rounded-full bg-primary animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        </div>
      ) : statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
      {!retrying && failedFiles.length > 0 && <button type="button" onClick={() => void retry()} disabled={disabled} className="w-fit text-xs font-medium text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">Retry face detection</button>}
      {faces.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Detected people ({faces.length}) — mark whether each person is an employee:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {faces.map(({ key, file, box }, faceIndex) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background p-2">
                <button type="button" onClick={() => setZoomedFace({ file, box, faceIndex })} title="Click to enlarge face" className="size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-border bg-muted"><FaceCropPreview url={file.url} box={box} /></button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-xs font-medium text-foreground">Person {faceIndex + 1} · {file.original_name}</p>
                  {faceAutoMatched?.[key] != null && (
                    <span className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      Matched saved employee
                    </span>
                  )}
                  {(faceSamePerson?.[key]?.length ?? 0) > 0 && (
                    <span className="inline-block rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                      Same person in: {faceSamePerson![key].join(", ")}
                    </span>
                  )}
                  <p className="text-[11px] text-muted-foreground">Employee?</p>
                  <div className="flex gap-1.5">{[true, false].map((answer) => <label key={`${key}-${String(answer)}`} className="flex min-h-7 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={`${id}-emp-${key}`} checked={faceFlags?.[key] === answer} onChange={() => onFaceFlagChange?.(key, answer)} className="size-3 accent-primary" />{answer ? "Yes" : "No"}</label>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {detected === true && faces.length === 0 && <div className="pt-1"><p className="text-xs font-medium text-foreground">Is any person shown an employee?</p><div className="mt-1.5 flex flex-wrap gap-2">{[true, false].map((answer) => <label key={`employee-${String(answer)}`} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={`${id}-employee`} checked={employeeValue === answer} onChange={() => onEmployeeChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}</div></div>}
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
