import { useQuery } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";

/** Older script responses omit names; resolve the post's actual review assignment. */
export function useScriptReviewerLabel(submissionId: string, reviewerNames?: string[], enabled = true) {
  const names = reviewerNames?.filter((name) => name.trim());
  const needsAssignment = enabled && !names?.length;
  const submission = useQuery({
    queryKey: ["submission", submissionId],
    queryFn: () => submissionService.get(submissionId),
    enabled: needsAssignment,
    staleTime: 0,
  });
  const ids = submission.data?.reviewer_ids;
  const directory = useQuery({
    queryKey: ["script-reviewer-directory"],
    queryFn: () => submissionService.reviewers(),
    enabled: needsAssignment && Boolean(ids?.length),
    staleTime: 60_000,
  });

  if (names?.length) return `Sent for review to: ${names.join(", ")}`;
  if (!enabled || submission.isPending) return "Loading reviewer assignment...";
  if (submission.isError) return "Reviewer assignment unavailable";
  // An empty assignment routes the script to every reviewer on its brand.
  if (!ids?.length) return "Sent for review to: brand reviewers";
  if (directory.isPending) return "Loading assigned reviewers...";
  const resolved = ids.map((id) => directory.data?.find((reviewer) => reviewer.id === id));
  if (resolved.every((reviewer) => reviewer?.name)) {
    return `Sent for review to: ${resolved.map((reviewer) => reviewer!.name).join(", ")}`;
  }
  return `Sent for review to: ${ids.length} assigned reviewer${ids.length === 1 ? "" : "s"}`;
}
