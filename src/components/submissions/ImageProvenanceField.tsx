import { useId } from "react";
import { hasPostImages } from "@/lib/imageProvenance";
import type { SubmissionFile } from "@/types/submission";

function ProvenanceChoice({ name, label, selected, disabled, onSelect }: { name: string; label: string; selected: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <label className="flex min-h-8 min-w-[4.5rem] cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-default has-disabled:opacity-60">
      <input type="radio" name={name} value={label.toLowerCase()} checked={selected} disabled={disabled} required onChange={onSelect} className="size-3.5 accent-primary" />
      {label}
    </label>
  );
}

export default function ImageProvenanceField({ files, value, disabled, invalid = false, onChange }: {
  files: SubmissionFile[];
  value: boolean | null;
  disabled: boolean;
  invalid?: boolean;
  onChange: (answer: boolean) => void;
}) {
  const id = useId();
  const yes = () => onChange(true);
  const no = () => onChange(false);
  const hint = disabled && value == null ? "Not answered for this post." : "Select Yes if any attached image was generated using AI.";
  if (!hasPostImages(files)) return null;
  return (
    <fieldset disabled={disabled} aria-required="true" aria-invalid={invalid || undefined} aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold text-foreground">Does this post contain an AI-generated image? <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only"> (required)</span></legend>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-2"><ProvenanceChoice name={id} label="Yes" selected={value === true} disabled={disabled} onSelect={yes} /><ProvenanceChoice name={id} label="No" selected={value === false} disabled={disabled} onSelect={no} /></div>
      {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">Choose Yes or No to continue.</p>}
    </fieldset>
  );
}
