import { format } from "date-fns";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export default function FinalPublishDate({ intended, value, onChange, disabled, error }: {
  intended: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Intended publish date: {format(new Date(intended), "EEE, MMM d, yyyy · h:mm a")}</p>
      <label htmlFor="final-publish-date" className="block text-sm font-medium">Final publish date and time (required)</label>
      <DateTimePicker id="final-publish-date" aria-label="Final publish date and time" value={value} onChange={onChange} withTime disablePast disabled={disabled} />
      <p className="text-xs text-muted-foreground">Confirm or change the intended date before publishing. Times use your local time zone.</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
