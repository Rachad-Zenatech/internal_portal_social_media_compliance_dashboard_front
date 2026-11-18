import { useMemo } from "react";
import { useSentToSprout } from "@/lib/contentCalendar";
import { applySubmissionSchedule } from "@/lib/submissionSchedule";
import type { SubmissionSummary } from "@/types/submission";

/** Refresh tags, counts and filters as soon as calendar scheduling changes. */
export function useScheduledSubmissions(submissions: SubmissionSummary[]) {
  const scheduled = useSentToSprout();
  return useMemo(() => submissions.map((submission) => applySubmissionSchedule(submission, scheduled[`sub-${submission.id}`])), [submissions, scheduled]);
}
