import { CheckCircle2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ApprovedScriptNextStep({ submissionId, canAttachVideo }: { submissionId: string; canAttachVideo: boolean }) {
  const message = canAttachVideo
    ? "Your script is approved. Film your video, then attach it to this post for review."
    : "Waiting for the creator to film and submit the video.";
  return (
    <div className="flex flex-col gap-2.5 border-t border-border/70 bg-emerald-50/50 p-4 dark:bg-emerald-500/10">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" /> Script approved
      </div>
      <p role="status" className="text-xs leading-relaxed text-muted-foreground">{message}</p>
      {canAttachVideo && (
        <Button asChild className="h-9 gap-1.5 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800">
          <Link to={`/submissions/new?id=${submissionId}`}><Upload aria-hidden="true" className="size-3.5" /> Attach Video to Post</Link>
        </Button>
      )}
    </div>
  );
}
