import type { SproutRecord } from "@/lib/contentCalendar";
import type { SubmissionSummary } from "@/types/submission";
import type { CalendarSubmission, SubmissionStage } from "@/types/submissionSchedule";

/** An intended date alone does not mean the creator scheduled the post. */
export function applySubmissionSchedule(submission: SubmissionSummary, record?: SproutRecord): CalendarSubmission {
  if (submission.status !== "APPROVED" || !record) return submission;
  const scheduledFor = record.scheduled_for ?? submission.publish_at;
  if (!scheduledFor || !Number.isFinite(Date.parse(scheduledFor))) return submission;
  return { ...submission, publish_at: scheduledFor, calendar_scheduled_for: scheduledFor };
}

export function stageOf(submission: { status: string; calendar_scheduled_for?: string }): SubmissionStage {
  return submission.status === "APPROVED" && submission.calendar_scheduled_for
    ? "SCHEDULED" : submission.status as SubmissionStage;
}
