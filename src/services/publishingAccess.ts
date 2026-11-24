import { submissionService } from "@/services/submissionService";

/** Validate immediately before writing a simulated schedule or publish result. */
export async function requirePublishingAccess(itemId: string) {
  if (!itemId.startsWith("sub-")) return;
  const access = await submissionService.publishingAccess(itemId.slice(4));
  if (!access.can_publish) throw new Error(access.message || "Publishing is not available yet.");
}
