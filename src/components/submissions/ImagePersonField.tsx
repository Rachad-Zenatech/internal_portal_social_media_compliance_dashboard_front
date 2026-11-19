import { useId } from "react";
import { hasPostImages } from "@/lib/imageProvenance";
import type { SubmissionFile } from "@/types/submission";

export default function ImagePersonField({ files, value, detected, disabled, onChange }: {
  files: SubmissionFile[];
  value: boolean | null;
  detected?: boolean | null;
  disabled: boolean;
  onChange: (answer: boolean) => void;
}) {
  const id = useId();
  if (!hasPostImages(files)) return null;
  const detection = detected == null ? "We are reading the uploaded image(s); please confirm the result when ready." : detected ? "We found a person in an uploaded image. Confirm or correct this result." : "We did not find a person in the uploaded image(s). Confirm or correct this result.";
  return (
    <fieldset disabled={disabled} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold text-foreground">Does this post show a person?</legend>
      <p className="text-xs text-muted-foreground">{detection}</p>
      <div className="flex flex-wrap gap-2">
        {[true, false].map((answer) => <label key={String(answer)} className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={id} checked={value === answer} onChange={() => onChange(answer)} className="size-3.5 accent-primary" />{answer ? "Yes" : "No"}</label>)}
      </div>
    </fieldset>
  );
}
