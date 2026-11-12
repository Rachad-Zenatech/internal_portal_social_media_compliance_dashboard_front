import { StatCard, scrollToSection } from "@/components/dashboard/dashboardParts";
import type { DashboardSummary } from "@/types/submission";

/** Which part of the review queue the list shows: all of it, what is late, or what has a failing check. */
export type QueueFilter = "all" | "overdue" | "failing";

/**
 * The reviewer's numbers at a glance. Each card is a shortcut to what it counts: it narrows the queue below (click again
 * to put it back), and "Reviewed" goes to the review activity.
 */
export default function ReviewerStats({
  loading,
  waiting,
  waitingNote,
  overdue,
  failing,
  summary,
  filter,
  onFilter,
}: {
  loading: boolean;
  waiting: number;
  waitingNote: string | null;
  overdue: number;
  failing: number;
  summary?: DashboardSummary;
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
}) {
  const pick = (f: QueueFilter) => {
    onFilter(filter === f ? "all" : f);
    scrollToSection("reviewer-queue");
  };
  const redOrGreen = (n: number, bad: "red" | "amber") => (n ? bad : ("green" as const));
  return (
    <section aria-label="Your review queue at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        label="Waiting for you"
        value={loading ? "–" : waiting}
        note={waiting ? waitingNote : "All caught up"}
        active={false}
        hint="Show everything waiting for you"
        onClick={() => pick("all")}
      />
      <StatCard
        label="Overdue"
        value={loading ? "–" : overdue}
        note={overdue ? "Past their review deadline" : "None overdue"}
        noteTone={redOrGreen(overdue, "red")}
        active={filter === "overdue"}
        hint={filter === "overdue" ? "Show everything again" : "Show only what is overdue"}
        onClick={() => pick("overdue")}
      />
      <StatCard
        label="Failing checks"
        value={loading ? "–" : failing}
        note={failing ? "Red result or score under 60" : "No failing checks"}
        noteTone={redOrGreen(failing, "amber")}
        active={filter === "failing"}
        hint={filter === "failing" ? "Show everything again" : "Show only what has a failing check"}
        onClick={() => pick("failing")}
      />
      <StatCard
        label="Reviewed"
        value={summary ? summary.reviews_completed : "–"}
        note={summary ? `Last 30 days · ${summary.approved} approved, ${summary.changes_requested} sent back` : null}
        hint="See your review activity"
        onClick={() => scrollToSection("reviewer-activity")}
      />
    </section>
  );
}
