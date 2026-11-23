import { Loader2, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

const RUN_STYLE = "h-12 gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-blue-800";

/** Consistent run and stop actions for the post's analysis panels. */
export function AnalysisRunControls({ running, disabled, stopping = false, label, onRun, onStop }: {
  running: boolean;
  disabled?: boolean;
  stopping?: boolean;
  label: string;
  onRun: () => void;
  onStop?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" className={RUN_STYLE} disabled={running || disabled} onClick={onRun}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {label}
      </Button>
      {running && onStop && (
        <Button type="button" variant="outline" className="h-12 gap-2" disabled={stopping} onClick={onStop}>
          <Square className="h-4 w-4" />{stopping ? "Stopping…" : "Stop"}
        </Button>
      )}
    </div>
  );
}
