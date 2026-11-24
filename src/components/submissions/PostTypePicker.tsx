import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import VideoScriptModeCheckbox, { type VideoScriptMode } from "./VideoScriptModeCheckbox";
import type { ContentType } from "@/types/submission";

interface PostTypeOption {
  value: ContentType;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface PostTypePickerProps {
  value: ContentType;
  scriptMode?: VideoScriptMode;
  options: PostTypeOption[];
  description?: string;
  disabled: boolean;
  onChange: (value: ContentType) => void;
}

export default function PostTypePicker({ value, options, description, disabled, onChange, scriptMode }: PostTypePickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold text-foreground">What kind of post is it?</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Content type">
        {options.map((option) => <PostTypeButton key={option.value} option={option} selected={value === option.value} disabled={disabled} onChange={onChange} />)}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {value === "VIDEO" && scriptMode && <VideoScriptModeCheckbox {...scriptMode} disabled={disabled || scriptMode.disabled} />}
    </div>
  );
}

function PostTypeButton({ option, selected, disabled, onChange }: {
  option: PostTypeOption;
  selected: boolean;
  disabled: boolean;
  onChange: (value: ContentType) => void;
}) {
  const Icon = option.icon;
  const colors = selected
    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
    : "border-border bg-card text-muted-foreground hover:border-slate-400 hover:text-foreground";
  return (
    <button type="button" role="radio" aria-checked={selected} title={option.description} disabled={disabled}
      onClick={() => onChange(option.value)}
      className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${colors}`}>
      <Icon className="h-4 w-4" />
      {option.label}
    </button>
  );
}
