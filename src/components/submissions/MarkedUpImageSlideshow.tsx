import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KeyboardEvent } from "react";

import MediaFindingOverlay from "@/components/submissions/MediaFindingOverlay";
import ZoomableImageDialog from "@/components/submissions/ZoomableImageDialog";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import type { useImageSlideshow } from "@/hooks/useImageSlideshow";
import type { ComplianceViolation, ImageFindingRegion } from "@/services/complianceService";
import type { SubmissionFile } from "@/types/submission";

interface Props {
  slideshow: ReturnType<typeof useImageSlideshow>;
  findings: ComplianceViolation[];
  sourceRegions?: ImageFindingRegion[];
}

function SlideThumbnail({ file, index, selected, onSelect }: {
  file: SubmissionFile; index: number; selected: boolean; onSelect: () => void;
}) {
  const label = `Show image ${index + 1}: ${file.original_name}`;
  return (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onSelect}
      className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 ${selected ? "border-primary" : "border-border"}`}>
      <img src={authedFileUrl(file.url)} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

/** Every image in the post, with highlights scoped to the currently displayed file. */
export default function MarkedUpImageSlideshow({ slideshow, findings, sourceRegions }: Props) {
  const { slides, active, activeIndex, select, move, imageOpen, setImageOpen } = slideshow;
  if (!active) return null;
  const multiple = slides.length > 1;
  const counter = `Image ${activeIndex + 1} of ${slides.length}`;
  const previous = () => move(-1);
  const next = () => move(1);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!multiple || event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  };
  const thumbnails = slides.map((file, index) => (
    <SlideThumbnail key={file.id} file={file} index={index} selected={file.id === active.id} onSelect={() => select(file.id)} />
  ));
  return (
    <div role="region" aria-roledescription="carousel" aria-label="Post images" onKeyDown={onKeyDown} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">{counter}</span>
        {multiple && <div className="flex gap-1">
          <button type="button" onClick={previous} aria-label="Previous image" className="rounded-md border p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={next} aria-label="Next image" className="rounded-md border p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></button>
        </div>}
      </div>
      <div role="group" aria-roledescription="slide" aria-label={counter}>
        <button type="button" onClick={() => setImageOpen(true)} title="Open full-size image" className="block w-full cursor-zoom-in">
          <div className="relative mx-auto w-fit max-w-full">
            <img src={authedFileUrl(active.url)} alt={`${counter}: ${active.original_name}`} className="block max-h-[420px] max-w-full rounded-xl" />
            <MediaFindingOverlay findings={findings} sourceRegions={sourceRegions} fileId={active.id} />
          </div>
        </button>
      </div>
      {multiple && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose an image">{thumbnails}</div>}
      <ZoomableImageDialog key={active.id} fileId={active.id} open={imageOpen} onOpenChange={setImageOpen} src={authedFileUrl(active.url)} findings={findings} sourceRegions={sourceRegions} />
    </div>
  );
}
