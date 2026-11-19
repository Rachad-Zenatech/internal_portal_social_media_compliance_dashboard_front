import type { SproutRecord } from "@/lib/contentCalendar";
import type { QueueTab, ReviewQueueItem } from "@/types/submission";

export type ScreenerTab = QueueTab | "approved";

/** Approval alone leaves the post with its creator; only their scheduling confirmation moves it. */
export function splitApprovedQueue(posts: ReviewQueueItem[], sent: Record<string, SproutRecord>) {
  const approved: ReviewQueueItem[] = [];
  const scheduled: ReviewQueueItem[] = [];
  for (const post of posts) {
    if (post.status !== "APPROVED") continue;
    const record = sent[`sub-${post.id}`];
    const when = record?.scheduled_for ?? post.publish_at;
    const isScheduled = Boolean(record && when && Number.isFinite(Date.parse(when)));
    if (isScheduled) scheduled.push({ ...post, publish_at: when });
    else approved.push(post);
  }
  return { approved, scheduled };
}
