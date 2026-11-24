import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface VideoScriptMode {
  required: boolean;
  disabled: boolean;
  onChange: (required: boolean) => void;
}

export default function VideoScriptModeCheckbox({ required, disabled, onChange }: VideoScriptMode) {
  const id = useId();
  const descriptionId = id + "-description";
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={!required} disabled={disabled} aria-describedby={descriptionId}
          onCheckedChange={(checked) => onChange(checked !== true)} />
        <Label htmlFor={id}>Skip script review and upload the video directly</Label>
      </div>
      <p id={descriptionId} className="text-xs text-muted-foreground">
        Use this when your script is already approved outside this platform. The video still needs compliance checks and post approval.
      </p>
    </div>
  );
}
