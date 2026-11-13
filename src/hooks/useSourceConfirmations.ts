import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";
import type { SourceConfirmation, SourceConfirmationRequest, SourceTrust } from "@/types/sourceTrust";

/** A site as source trust keys it: lower case, without "www.". */
export function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** The claim as the server keys it: case, spacing and punctuation don't matter. */
function claimKey(claim?: string | null): string {
  return (claim ?? "").toLowerCase().match(/[a-z0-9.$%]+/g)?.join(" ") ?? "";
}

export interface SourceConfirmationsApi {
  /** The signed-in person's call on a claim (or, with no claim, on the page). */
  mine: (url: string, claim?: string | null) => SourceConfirmation | undefined;
  /** Reviewers' calls on a claim, other than the signed-in person's. */
  reviewers: (url: string, claim: string) => SourceConfirmation[];
  trust: (url: string) => SourceTrust | undefined;
  confirm: (data: SourceConfirmationRequest) => void;
  saving: boolean;
  countsTowardTrust: boolean;
}

/** Everyone's calls on a post's sources and each source's standing with reviewers, and a way to add one's own. */
export function useSourceConfirmations(submissionId: string | null | undefined, urls: string[]): SourceConfirmationsApi {
  const queryClient = useQueryClient();
  const key = ["source-confirmations", submissionId, [...urls].sort().join("|")];
  const query = useQuery({
    queryKey: key,
    queryFn: () => submissionService.getSourceConfirmations(submissionId!, urls),
    enabled: Boolean(submissionId),
    staleTime: 30_000,
  });
  const save = useMutation({
    mutationFn: (data: SourceConfirmationRequest) => submissionService.confirmSource(submissionId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["source-confirmations", submissionId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save your call on this source."),
  });

  const calls = query.data?.confirmations ?? [];
  const same = (c: SourceConfirmation, url: string, claim?: string | null) =>
    c.url === url && claimKey(c.claim) === claimKey(claim);
  return {
    mine: (url, claim) => calls.find((c) => c.mine && same(c, url, claim)),
    reviewers: (url, claim) => calls.filter((c) => c.by_reviewer && !c.mine && same(c, url, claim)),
    trust: (url) => query.data?.trust[hostOf(url)],
    confirm: (data) => submissionId && save.mutate(data),
    saving: save.isPending,
    countsTowardTrust: Boolean(query.data?.counts_toward_trust),
  };
}
