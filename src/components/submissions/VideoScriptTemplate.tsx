import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VideoScriptTemplate() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="w-3.5 h-3.5 shrink-0" />
        Writing a script? Start from the template: title, storyline, hook and a timed shot table.
      </p>
      <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
        <a href={import.meta.env.BASE_URL + "templates/script-template.docx"} download="script-template.docx">
          <Download className="w-3.5 h-3.5" />
          Export template (.docx)
        </a>
      </Button>
    </div>
  );
}
