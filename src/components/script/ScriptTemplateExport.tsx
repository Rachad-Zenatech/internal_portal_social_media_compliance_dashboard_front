import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Use the same template download wherever creators start a script. */
export default function ScriptTemplateExport({ card = false }: { card?: boolean }) {
  const href = import.meta.env.BASE_URL + "templates/script-template.docx";
  const label = "Export template (.docx)";
  if (card) {
    return (
      <a href={href} download="script-template.docx" className="flex flex-col gap-0.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-blue-300 hover:bg-muted/30">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Download className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          Download the Word template with a title, storyline, hook and timed shot table.
        </span>
      </a>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
      <a href={href} download="script-template.docx">
        <Download className="w-3.5 h-3.5" />
        {label}
      </a>
    </Button>
  );
}
