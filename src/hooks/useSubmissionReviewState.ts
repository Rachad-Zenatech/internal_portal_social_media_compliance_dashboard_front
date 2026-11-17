import { useQuery } from "@tanstack/react-query";
import { submissionService } from "@/services/submissionService";
import type { Submission } from "@/types/submission";

/** Refresh review permissions without replacing the creator's unsaved form fields. */
export function useSubmissionReviewState(snapshot: Submission | null) {
  const { data } = useQuery({
    queryKey: ["submission", snapshot?.id],
    queryFn: () => submissionService.get(snapshot!.id),
    initialData: snapshot ?? undefined,
    enabled: Boolean(snapshot && ["IN_REVIEW", "CHANGES_REQUESTED"].includes(snapshot.status)),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) =>
      ["IN_REVIEW", "CHANGES_REQUESTED"].includes(query.state.data?.status ?? "") ? 10_000 : false,
  });
  return data ?? snapshot;
}
