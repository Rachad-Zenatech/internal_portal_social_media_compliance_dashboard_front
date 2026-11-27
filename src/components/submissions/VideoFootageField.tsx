import { useId } from "react";

export default function VideoFootageField({ enabled, value, disabled, invalid, onChange }: {
  enabled: boolean; value: boolean | null; disabled: boolean; invalid: boolean; onChange: (value: boolean) => void;
}) {
  const id = useId();
  if (!enabled) return null;
  return (
    <fieldset disabled={disabled} aria-required="true" aria-invalid={invalid || undefined} aria-describedby={`${id}-hint`} className="mt-4 space-y-2 rounded-xl border border-border/70 px-4 pb-3 pt-2.5">
      <legend className="px-1 text-sm font-semibold">Does this video contain stock, third-party or AI-generated footage? <span className="text-destructive" aria-hidden="true">*</span></legend>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">Select Yes if any part of the video uses this footage, including videos mixed with your own clips.</p>
      <div className="flex gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={id} required checked={value === true} onChange={() => onChange(true)} className="accent-primary" />Yes</label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs has-checked:border-primary has-checked:bg-primary/5"><input type="radio" name={id} required checked={value === false} onChange={() => onChange(false)} className="accent-primary" />No</label>
      </div>
      {value === true && <p className="rounded-lg bg-muted/50 p-2.5 text-xs leading-relaxed">Show this readable disclaimer anywhere in the video, at least once: <strong>“This video may include stock, third-party or AI-generated footage.”</strong> Adding it only to the post text does not count.</p>}
      {invalid && <p role="alert" className="text-xs text-destructive">Choose Yes or No to continue.</p>}
    </fieldset>
  );
}
