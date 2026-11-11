import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { scriptBatchService } from "@/services/scriptBatchService";
import type { Batch, BatchDetails, ItemDecision } from "@/types/scriptBatch";

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** The batches a person uploaded, or (reviewers) those sent for review. */
export function useScriptBatches(scope: "mine" | "review", enabled = true) {
  return useQuery({
    queryKey: ["script-batches", scope],
    queryFn: () => scriptBatchService.list(scope),
    enabled,
    staleTime: 15_000,
  });
}

/** One batch, refreshed while its scripts are being checked, and told when that finishes. */
export function useScriptBatch(id?: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["script-batch", id],
    queryFn: () => scriptBatchService.get(id!),
    enabled: Boolean(id),
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === "PROCESSING" ? 2000 : false),
  });
  const wasProcessing = useRef(false);
  const status = query.data?.status;
  useEffect(() => {
    if (wasProcessing.current && status && status !== "PROCESSING") {
      queryClient.invalidateQueries({ queryKey: ["script-batches"] });
      if (query.data?.error) toast.error(query.data.error);
      else toast.success("Scripts sent for review. Reviewers have been notified.");
    }
    wasProcessing.current = status === "PROCESSING";
  }, [status, query.data?.error, queryClient]);
  return query;
}

/** The creator's actions on a batch: details, edits to its scripts, and sending it. Each answers with the batch. */
export function useBatchActions(id: string) {
  const queryClient = useQueryClient();
  const keep = (batch: Batch) => {
    queryClient.setQueryData(["script-batch", id], batch);
    queryClient.invalidateQueries({ queryKey: ["script-batches"] });
  };
  const fail = (fallback: string) => (e: unknown) => toast.error(message(e, fallback));

  return {
    saveDetails: useMutation({
      mutationFn: (data: { title?: string; details?: BatchDetails }) => scriptBatchService.update(id, data),
      onSuccess: keep,
      onError: fail("Couldn't save the details"),
    }),
    addItem: useMutation({
      mutationFn: (data: { title: string; body: string }) => scriptBatchService.addItem(id, data),
      onSuccess: keep,
      onError: fail("Couldn't add the script"),
    }),
    updateItem: useMutation({
      mutationFn: ({ itemId, ...data }: { itemId: string; title?: string; body?: string }) =>
        scriptBatchService.updateItem(id, itemId, data),
      onSuccess: keep,
      onError: fail("Couldn't save the script"),
    }),
    removeItem: useMutation({
      mutationFn: (itemId: string) => scriptBatchService.removeItem(id, itemId),
      onSuccess: keep,
      onError: fail("Couldn't remove the script"),
    }),
    send: useMutation({
      mutationFn: () => scriptBatchService.send(id),
      onSuccess: keep,
      onError: fail("Couldn't send the scripts"),
    }),
  };
}

/** The reviewer's decisions on any number of a batch's scripts at once. */
export function useReviewBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { decisions: ItemDecision[]; due_days?: number }) => scriptBatchService.review(id, data),
    onSuccess: (result) => {
      queryClient.setQueryData(["script-batch", id], result.batch);
      queryClient.invalidateQueries({ queryKey: ["script-batches"] });
      // Approved scripts are now posts.
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["script-queue"] });
    },
    onError: (e) => toast.error(message(e, "Couldn't save the decisions")),
  });
}
