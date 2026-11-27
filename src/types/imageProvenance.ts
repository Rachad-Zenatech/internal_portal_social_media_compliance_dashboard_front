/** Saved answer to the post's required AI-image disclosure question. */
export interface ImageProvenance {
  ai_generated_images?: boolean;
  ai_generated_images_confirmed?: boolean;
  people_in_images?: boolean;
  people_in_images_confirmed?: boolean;
  people_in_images_detected?: boolean | null;
  employee_in_images?: boolean;
  employee_in_images_confirmed?: boolean;
  face_employee_flags?: Record<string, boolean>;
  face_auto_matched?: Record<string, number>;
  face_same_person?: Record<string, string[]>;
}
