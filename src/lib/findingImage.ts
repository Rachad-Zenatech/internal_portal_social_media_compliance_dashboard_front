import type { ComplianceViolation } from "@/services/complianceService";
import type { SubmissionFile } from "@/types/submission";
import { findingEvidence } from "@/lib/findingEvidence";

/** A rule can produce separate caption and image findings, so its ID alone is not a selection key. */
export const findingSelectionKey = (finding: ComplianceViolation, index: number) => `${finding.rule_id}-${finding.kind ?? ""}-${index}`;

/** Prefer the clicked finding's evidence; shared rule evidence is used only when it identifies one image. */
export function selectFindingImage(finding: ComplianceViolation, slideshow: { slides: SubmissionFile[]; activeIndex: number; select: (id: string) => void }, relatedFindings: ComplianceViolation[] = [finding]): boolean {
  const index = findingImageIndex(slideshow.slides, [finding], finding.rule_id, slideshow.activeIndex, relatedFindings);
  if (index < 0 && slideshow.slides.length === 1 && !(finding.image_file_ids?.length || finding.image_regions?.length)) {
    slideshow.select(slideshow.slides[0].id);
    return true;
  }
  if (index < 0) return false;
  slideshow.select(slideshow.slides[index].id);
  return true;
}

/** Locate the image linked to a rule; an unknown location leaves the current slide unchanged. */
export function findingImageIndex(images: SubmissionFile[], findings: ComplianceViolation[], ruleId: string, currentIndex: number, relatedFindings: ComplianceViolation[] = findings): number {
  const matches = findings.filter((finding) => finding.rule_id === ruleId);
  const fileIds = new Set(matches.flatMap((finding) => [...(finding.image_file_ids ?? []), ...(finding.image_regions ?? []).map((region) => region.file_id)]));
  const linked = images.map((image, index) => fileIds.has(image.id) ? index : -1).filter((index) => index >= 0);
  if (linked.length) return linked.includes(currentIndex) ? currentIndex : linked[0];
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const terms = matches.flatMap(findingEvidence).map(normalize).filter(Boolean);
  const fromText = images.map((image, index) => image.doc_text && terms.some((term) => normalize(image.doc_text!).includes(term)) ? index : -1).filter((index) => index >= 0);
  if (fromText.length) return fromText.includes(currentIndex) ? currentIndex : fromText[0];
  // The overlay combines all findings. Some claim findings share a rule's measured image evidence.
  const ruleNumber = (value: string) => value.toLowerCase().replace(/^rule\s*/i, "").trim();
  const numbers = new Set(matches.map((finding) => ruleNumber(finding.rule_number ?? "")).filter(Boolean));
  const sharedIds = new Set(relatedFindings.filter((finding) => finding.rule_id === ruleId || numbers.has(ruleNumber(finding.rule_number ?? "")))
    .flatMap((finding) => [...(finding.image_file_ids ?? []), ...(finding.image_regions ?? []).map((region) => region.file_id)]));
  const sharedImages = images.map((image, index) => sharedIds.has(image.id) ? index : -1).filter((index) => index >= 0);
  return sharedImages.length === 1 ? sharedImages[0] : -1;
}
