import type { SubmissionSummary } from "@/types/submission";

export type SubmissionStage = "DRAFT" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "REJECTED";

/** Calendar timing displayed alongside the server's review status. */
export type CalendarSubmission = SubmissionSummary & { calendar_scheduled_for?: string };
