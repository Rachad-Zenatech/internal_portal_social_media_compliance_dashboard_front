import type { DocDetail } from "@/types/scriptDoc";

/** A document creator may write and submit, but cannot review or decide on their own script. */
export function scriptReviewDocument(doc: DocDetail, viewerId: string | undefined, creatorView: boolean): DocDetail {
  const creator = !viewerId || creatorView || doc.creator_id === viewerId || doc.access.role === "CREATOR";
  const reviewer = !creator && (doc.access.role === "REVIEWER" || doc.access.role === "MANAGER");
  const canCheckIn = !creator && (reviewer || doc.access.role === "SUGGESTER");
  return {
    ...doc,
    access: {
      ...doc.access,
      can_check_in: canCheckIn && doc.access.can_check_in,
      can_finalize: reviewer && doc.access.can_finalize,
      can_decide: reviewer && doc.access.can_decide,
    },
  };
}
