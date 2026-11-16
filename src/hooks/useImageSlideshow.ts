import { useState } from "react";
import type { SubmissionFile } from "@/types/submission";

/** Main carousel slides first, followed by extra images; preserve the upload order within each kind. */
export function imageSlides(files: SubmissionFile[]) {
  return files.filter((file) => file.kind === "MAIN" && file.mime_type.startsWith("image/"))
    .concat(files.filter((file) => file.kind === "IMAGE" && file.mime_type.startsWith("image/")));
}

export function useImageSlideshow(files: SubmissionFile[]) {
  const slides = imageSlides(files);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const activeIndex = Math.max(0, slides.findIndex((file) => file.id === selectedId));
  const active = slides[activeIndex];
  const select = (id: string) => setSelectedId(id);
  const move = (direction: number) => {
    if (slides.length) select(slides[(activeIndex + direction + slides.length) % slides.length].id);
  };
  return { slides, active, activeIndex, select, move, imageOpen, setImageOpen };
}
