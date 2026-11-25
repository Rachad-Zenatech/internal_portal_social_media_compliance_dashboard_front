import { useState, type WheelEvent } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import MediaFindingOverlay from "@/components/submissions/MediaFindingOverlay";
import type { ComplianceViolation, ImageFindingRegion } from "@/services/complianceService";

interface Props {
  open: boolean;
  src: string;
  fileId?: string;
  findings: ComplianceViolation[];
  sourceRegions?: ImageFindingRegion[];
  disclaimerRegions?: ImageFindingRegion[];
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

/** Full-size image preview that zooms toward the point under the mouse wheel. */
export default function ZoomableImageDialog({ open, src, fileId, findings, sourceRegions, disclaimerRegions, onOpenChange }: Props) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [origin, setOrigin] = useState("50% 50%");

  const close = () => {
    setZoom(MIN_ZOOM);
    onOpenChange(false);
  };

  const zoomAtPointer = (event: WheelEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
      <DialogContent aria-label="Full-size post image" showCloseButton={false} className="w-max max-w-[90vw] sm:max-w-[90vw] gap-0 overflow-hidden p-1">
        <DialogTitle className="sr-only">Full-size post image</DialogTitle>
        <button type="button" onClick={close} onWheel={zoomAtPointer} aria-label="Close full-size image" title="Scroll to zoom; click to close" className="inline-block cursor-zoom-out overflow-hidden">
          <div className="relative inline-block transition-transform duration-100" style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
            <img src={src} alt="Full-size post" className="block max-h-[82dvh] max-w-[calc(90vw-0.5rem)] object-contain" />
            <MediaFindingOverlay findings={findings} sourceRegions={sourceRegions} disclaimerRegions={disclaimerRegions} fileId={fileId} showRuleTooltip />
          </div>
        </button>
      </DialogContent>
    </Dialog>
  );
}
