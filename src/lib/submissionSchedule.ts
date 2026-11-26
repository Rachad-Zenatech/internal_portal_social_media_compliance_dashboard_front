import { reviewOutcomeStatus } from "@/lib/reviewOutcome";
import { recordSproutSend, type SproutRecord } from "@/lib/contentCalendar";
import type { Submission, SubmissionSummary } from "@/types/submission";
import type { CalendarSubmission, SubmissionStage } from "@/types/submissionSchedule";

/** An intended date alone does not mean the creator scheduled the post. */
export function applySubmissionSchedule(submission: SubmissionSummary, record?: SproutRecord): CalendarSubmission {
  if (submission.status !== "APPROVED" || !record) return submission;
  const scheduledFor = record.scheduled_for ?? submission.publish_at;
  if (!scheduledFor || !Number.isFinite(Date.parse(scheduledFor))) return submission;
  return { ...submission, publish_at: scheduledFor, calendar_scheduled_for: scheduledFor };
}

export function stageOf(submission: { status: string; publish_after_changes?: boolean; calendar_scheduled_for?: string }): SubmissionStage {
  return submission.status === "APPROVED" && submission.calendar_scheduled_for
    ? "SCHEDULED" : reviewOutcomeStatus(submission) as SubmissionStage;
}

/** Schedule a corrected post only after its submission has passed server checks. */
export async function scheduleCorrectedPost(submission: Pick<Submission, "id" | "status">, publishDate?: Date): Promise<string | null> {
  if (submission.status !== "APPROVED" || !publishDate || !Number.isFinite(publishDate.getTime())) return null;
  const scheduledFor = publishDate.toISOString();
  await recordSproutSend(`sub-${submission.id}`, scheduledFor);
  return `/content-calendar?date=${encodeURIComponent(scheduledFor)}&post=sub-${submission.id}`;
}
