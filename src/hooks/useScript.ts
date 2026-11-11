import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/services/helper";

import { scriptService } from "@/services/scriptService";
import type { ScriptHighlight, ScriptStage } from "@/types/script";

/** A post's script stage, refreshed while its file is still being read. */
export function useScriptStage(submissionId?: string | null, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["script", submissionId],
    queryFn: () => scriptService.get(submissionId!),
    enabled: Boolean(submissionId) && enabled,
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data;
      const s = d?.file_status;
      if (d?.processing) return 2000;
      return (d?.file_name && s == null) || s === "PENDING" || s === "PROCESSING" ? 1500 : false;
    },
  });
  // When a send that was processing in the background finishes, refresh the lists and say how it went.
  const wasProcessing = useRef(false);
  const processing = Boolean(query.data?.processing);
  useEffect(() => {
    if (wasProcessing.current && !processing && query.data) {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["script-queue"] });
      if (query.data.send_error) toast.error(query.data.send_error);
      else toast.success("Script sent for review. Reviewers have been notified.");
    }
    wasProcessing.current = processing;
  }, [processing, query.data, queryClient, submissionId]);
  return query;
}

/** The script stage's actions: send it, decide on it, accept or revise the reviewer's edits. */
export function useScriptActions(submissionId: string) {
  const queryClient = useQueryClient();
  const done = (stage: ScriptStage) => {
    queryClient.setQueryData(["script", submissionId], stage);
    queryClient.invalidateQueries({ queryKey: ["script-queue"] });
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
    queryClient.invalidateQueries({ queryKey: ["submissions"] });
  };
  const fail = (what: string) => (err: unknown) => toast.error(`Couldn't ${what}: ${(err as Error).message}`);
  /** A script already sent: refused for the same place and date; for another date, offer to send it anyway. */
  const duplicate = (err: unknown, again: () => void): boolean => {
    if (!(err instanceof ApiError) || err.status !== 409 || !err.detail || typeof err.detail !== "object") return false;
    const detail = err.detail as { code?: string; message?: string };
    if (detail.code === "REPOST_CONFIRM") {
      toast(detail.message ?? "The same script was already sent for another date.", {
        duration: 15000,
        action: { label: "Send anyway", onClick: again },
      });
      return true;
    }
    if (detail.code === "DUPLICATE_SCRIPT") {
      toast.error(detail.message ?? "The same script was already sent for this date.");
      return true;
    }
    return false;
  };

  const submit = useMutation({
    mutationFn: (opts?: { confirmRepost?: boolean }) => scriptService.submit(submissionId, Boolean(opts?.confirmRepost)),
    onSuccess: (s) => {
      done(s);
      toast.success("Script received. Processing it and calculating the compliance score; it goes to the reviewers when that's done.");
    },
    onError: (err) => {
      if (!duplicate(err, () => submit.mutate({ confirmRepost: true }))) {
        toast.error(`Error sending the script: ${(err as Error).message}`);
      }
    },
  });
  const decide = useMutation({
    mutationFn: (data: { decision: "APPROVE" | "SEND_BACK"; text?: string; note?: string; due_days?: 1 | 2 | 3 | 5; due_at?: string }) =>
      scriptService.decide(submissionId, data),
    onSuccess: (s) => {
      done(s);
      toast.success(
        s.status === "APPROVED" ? "Script approved." : s.status === "EDITS_PROPOSED" ? "Sent back with your edits." : "Sent back for changes."
      );
    },
    onError: fail("save your decision"),
  });
  const accept = useMutation({
    mutationFn: () => scriptService.accept(submissionId),
    onSuccess: (s) => {
      done(s);
      toast.success("Script approved. You can upload the video now.");
    },
    onError: fail("accept the changes"),
  });
  const revise = useMutation({
    mutationFn: ({ text, note, confirmRepost }: { text: string; note?: string; confirmRepost?: boolean }) =>
      scriptService.revise(submissionId, text, note, Boolean(confirmRepost)),
    onSuccess: (s) => {
      done(s);
      toast.success("Script sent back to the reviewer.");
    },
    onError: (err, vars) => {
      if (!duplicate(err, () => revise.mutate({ ...vars, confirmRepost: true }))) fail("send the script")(err);
    },
  });
  return { submit, decide, accept, revise };
}

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** The rulebook check of wording being edited (null while it matches the saved version, or before it settles). */
export function useLiveScriptCheck(submissionId: string, text: string, saved: string) {
  const settled = useDebounced(text, 700);
  const changed = settled.trim() !== saved.trim() && settled.trim().length > 0;
  return useQuery({
    queryKey: ["script-check", submissionId, settled],
    queryFn: () => scriptService.check(submissionId, settled),
    enabled: changed,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * The reviewer's highlights and notes on a script version. Reviewers (`canEdit`) change them, and each change is saved
 * at once; the creator just sees them, refreshed every so often.
 */
export function useScriptHighlights(submissionId: string, version: number | undefined, canEdit: boolean) {
  const queryClient = useQueryClient();
  const key = ["script-highlights", submissionId, version];
  const query = useQuery({
    queryKey: key,
    queryFn: () => scriptService.highlights(submissionId, version!),
    enabled: version != null,
    refetchInterval: canEdit ? false : 20_000,
  });
  const save = useMutation({
    mutationFn: (next: ScriptHighlight[]) => scriptService.saveHighlights(submissionId, version!, next),
    onMutate: (next) => {
      queryClient.setQueryData(key, next);
    },
    onError: (err) => {
      toast.error(`Couldn't save the highlight: ${(err as Error).message}`);
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const resolve = useMutation({
    mutationFn: (resolutions: { id: string; done: boolean; updated?: string | null }[]) =>
      scriptService.resolveHighlights(submissionId, version!, resolutions),
    onSuccess: (next) => queryClient.setQueryData(key, next),
  });
  return {
    resolve,
    highlights: query.data ?? [],
    onChange: canEdit && version != null ? (next: ScriptHighlight[]) => save.mutate(next) : undefined,
  };
}
