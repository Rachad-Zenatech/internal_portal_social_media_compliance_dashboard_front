import { useState } from "react";
import { Download, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { scriptService } from "@/services/scriptService";

export default function CreatorScriptDownload({ submissionId, reference, version, onEdit }: {
  submissionId: string; reference: string; version: number; onEdit?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      await scriptService.download(submissionId, version, `${reference}-script-v${version}.docx`);
    } catch (error) {
      toast.error(`Couldn't download the script: ${(error as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">Download the saved script as a Word document. Film and upload once it is approved. Any wording changes need another script review.</p>
      <div className="flex flex-wrap gap-2">
        {onEdit && <Button variant="outline" className="h-10 flex-1 gap-1.5" onClick={onEdit}><PencilLine className="size-4" /> Edit script</Button>}
        <Button variant="outline" className="h-10 flex-1 gap-1.5" disabled={downloading} onClick={() => void download()}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Word document
        </Button>
      </div>
    </div>
  );
}
