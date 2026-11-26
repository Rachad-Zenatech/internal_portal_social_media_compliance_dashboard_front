import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { submissionService } from "@/services/submissionService";

/** Share the request state between reviewer text and compliance actions. */
export function useReviewerComplianceCheck(submissionId: string) {
  const client = useQueryClient();
  const mutationKey = ["reviewer-compliance-check", submissionId];
  const pending = useIsMutating({ mutationKey }) > 0;
  const mutation = useMutation({
    mutationKey,
    mutationFn: () => submissionService.runCheck(submissionId),
    onSuccess: result => {
      client.setQueryData(["submission", submissionId], result);
      void client.invalidateQueries({ queryKey: ["review-queue"] });
      void client.invalidateQueries({ queryKey: ["submission", submissionId] });
      toast.success("Compliance check updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const recheck = async () => {
    if (client.isMutating({ mutationKey }) > 0) return false;
    try { await mutation.mutateAsync(); return true; }
    catch { return false; }
  };
  return { checking: pending, recheck, error: mutation.error };
}
