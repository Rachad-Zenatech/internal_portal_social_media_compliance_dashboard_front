import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Use the same template download wherever creators start a script. */
export default function ScriptTemplateExport() {
  return (
    <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
      <a href={import.meta.env.BASE_URL + "templates/script-template.docx"} download="script-template.docx">
        <Download className="w-3.5 h-3.5" />
        Export template (.docx)
      </a>
    </Button>
  );
}
