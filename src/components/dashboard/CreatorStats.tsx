import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

import { StatCard, scrollToSection } from "@/components/dashboard/dashboardParts";
import type { DashboardSummary, SubmissionSummary } from "@/types/submission";

export type PostFilter = "all" | "IN_REVIEW" | "APPROVED";

/**
 * The creator's numbers at a glance. Each card is a shortcut: it narrows the list it counts and takes you there; click
 * it again to put the list back.
 */
export default function CreatorStats({
  loading,
  actions,
  changes,
  soonestDue,
  inReview,
  oldestInReview,
  summary,
  scheduled,
  filter,
  needsOnly,
  onNeeds,
  onFilter,
}: {
  loading: boolean;
  /** Changes to make and approved scripts waiting for their video. */
  actions: SubmissionSummary[];
  changes: SubmissionSummary[];
  soonestDue: { text: string; urgent: boolean } | null;
  inReview: SubmissionSummary[];
  oldestInReview: Date | null;
  summary?: DashboardSummary;
  scheduled: number;
  filter: PostFilter;
  needsOnly: boolean;
  onNeeds: () => void;
  onFilter: (f: PostFilter) => void;
}) {
  const navigate = useNavigate();
  const pick = (f: PostFilter) => {
    onFilter(filter === f ? "all" : f);
    scrollToSection("creator-recent");
  };
  const average = summary?.average_score;
  return (
    <section aria-label="Your posts at a glance" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        label="Needs your action"
        value={loading ? "–" : actions.length}
        note={soonestDue?.text ?? (actions.length ? `${changes.length} to fix · ${actions.length - changes.length} to film` : "All clear")}
        noteTone={soonestDue?.urgent ? "red" : soonestDue ? "amber" : "muted"}
        active={needsOnly}
        hint={needsOnly ? "Show everything again" : "Show only what needs your action"}
        onClick={() => {
          onNeeds();
          scrollToSection("creator-needs");
        }}
      />
      <StatCard
        label="In review"
        value={loading ? "–" : inReview.length}
        note={oldestInReview ? `Oldest waiting ${formatDistanceToNow(oldestInReview)}` : "Nothing waiting"}
        active={filter === "IN_REVIEW"}
        hint={filter === "IN_REVIEW" ? "Show all your posts" : "Show the posts with a reviewer"}
        onClick={() => pick("IN_REVIEW")}
      />
      <StatCard
        label="Approved"
        value={summary ? summary.approved : "–"}
        note={`Last 30 days${scheduled ? ` · ${scheduled} scheduled` : ""}`}
        active={filter === "APPROVED"}
        hint={filter === "APPROVED" ? "Show all your posts" : "Show your approved posts"}
        onClick={() => pick("APPROVED")}
      />
      <StatCard
        label="Average compliance score"
        value={
          average != null ? (
            <>
              {average}
              <span className="text-base font-medium text-muted-foreground"> / 100</span>
            </>
          ) : (
            "–"
          )
        }
        note="Last 30 days"
        hint="Open My posts to see each post's score"
        onClick={() => navigate("/submissions")}
      />
    </section>
  );
}
