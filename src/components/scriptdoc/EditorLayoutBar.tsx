import { Highlighter, PanelLeft, PanelRight, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A slim strip above the shared editor: shows or hides the pages list and the review panel, so the script gets the room it needs
 * (on a narrow screen, or when reading one script closely), and says which script of the document is open.
 */
export default function EditorLayoutBar({
  position,
  total,
  showPages,
  showPanel,
  onTogglePages,
  onTogglePanel,
  view,
  onView,
}: {
  position: number;
  total: number;
  showPages: boolean;
  showPanel: boolean;
  onTogglePages: () => void;
  onTogglePanel: () => void;
  /** For the writer of a script edited in the Share Document portal: the editor, or the reviewers' highlights on the text. */
  view?: "edit" | "marks";
  onView?: (v: "edit" | "marks") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1">
      <Button size="sm" variant={showPages ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={onTogglePages} aria-pressed={showPages}>
        <PanelLeft className="h-3.5 w-3.5" />
        Pages
      </Button>
      {onView ? (
        <span className="flex items-center gap-1" role="group" aria-label="What to show">
          <Button size="sm" variant={view === "edit" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => onView("edit")} aria-pressed={view === "edit"}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant={view === "marks" ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={() => onView("marks")} aria-pressed={view === "marks"}>
            <Highlighter className="h-3.5 w-3.5" />
            Reviewers' marks
          </Button>
        </span>
      ) : (
        total > 1 && (
          <span className="text-xs text-muted-foreground">
            Script {position} of {total}
          </span>
        )
      )}
      <Button size="sm" variant={showPanel ? "secondary" : "ghost"} className="h-7 gap-1.5 text-xs" onClick={onTogglePanel} aria-pressed={showPanel}>
        Notes, flags and review
        <PanelRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
