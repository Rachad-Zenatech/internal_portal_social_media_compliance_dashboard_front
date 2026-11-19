/** Saved answer to the post's required AI-image disclosure question. */
export interface ImageProvenance {
  ai_generated_images?: boolean;
  ai_generated_images_confirmed?: boolean;
  people_in_images?: boolean;
  people_in_images_confirmed?: boolean;
  people_in_images_detected?: boolean | null;
}
