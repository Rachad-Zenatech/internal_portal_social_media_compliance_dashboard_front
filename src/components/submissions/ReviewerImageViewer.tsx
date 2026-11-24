import { useState } from "react";
import { Maximize2 } from "lucide-react";

import ImageAnnotator from "@/components/submissions/ImageAnnotator";
import ZoomableImageDialog from "@/components/submissions/ZoomableImageDialog";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { Button } from "@/components/ui/button";
import type { SubmissionFile } from "@/types/submission";

/** Reviewer image with comment annotations and an unobstructed full-size view. */
export default function ReviewerImageViewer({
  submissionId,
  file,
  canDraw,
  activeId,
  onActive,
  onPlainClick,
}: {
  submissionId: string;
  file: SubmissionFile;
  canDraw: boolean;
  activeId: string | null;
  onActive: (id: string | null) => void;
  onPlainClick: () => void;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  return (
    <>
      <div className="flex max-w-full flex-col items-end gap-2">
        <ImageAnnotator
          key={file.id}
          imageClassName="max-h-[60vh] w-auto rounded-xl object-contain shadow-md ring-1 ring-border/60"
          submissionId={submissionId}
          file={file}
          canDraw={canDraw}
          activeId={activeId}
          onActive={onActive}
          onPlainClick={onPlainClick}
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => setImageOpen(true)} className="h-8 gap-1.5 px-2.5 shadow-sm">
          <Maximize2 className="h-3.5 w-3.5" /> Open full size
        </Button>
      </div>
      <ZoomableImageDialog
        key={file.id}
        open={imageOpen}
        onOpenChange={setImageOpen}
        src={authedFileUrl(file.url)}
        findings={[]}
        fileId={file.id}
      />
    </>
  );
}
