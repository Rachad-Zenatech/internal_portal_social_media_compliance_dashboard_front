import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTextReviewService } from "@/services/postTextReviewService";
import { ApiError } from "@/services/helper";
import type { PostTextReview } from "@/types/postTextReview";
import { submissionService } from "@/services/submissionService";

export function usePostTextReview(submissionId: string) {
  const client = useQueryClient();
  const queryKey = ["post-text-review", submissionId];
  const query = useQuery({ queryKey, queryFn: () => postTextReviewService.get(submissionId), refetchInterval: 5000 });
  const [draft, setDraft] = useState<{ text: string; base: PostTextReview } | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState(false);
  const text = draft?.text ?? query.data?.text ?? "";
  const changed = Boolean(draft && draft.text !== draft.base.text);
  const outdated = Boolean(draft && query.data && (draft.base.revision !== query.data.revision || draft.base.text !== query.data.text));
  const edit = () => {
    if (query.data) { setDraft({ text: query.data.text, base: query.data }); setConflict(false); }
  };
  const cancel = () => { setDraft(null); setConflict(false); };
  const recheck = async () => {
    if (checking || draft) return;
    setChecking(true);
    try {
      await submissionService.runCheck(submissionId);
      void client.invalidateQueries({ queryKey: ["review-queue"] });
      void client.invalidateQueries({ queryKey: ["submission", submissionId] });
      toast.success("Compliance check saved for the current post text.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setChecking(false); }
  };
  const save = async () => {
    if (!draft || saving || !changed) return;
    setSaving(true);
    try {
      const data = await postTextReviewService.save(submissionId, {
        text: draft.text, base_text: draft.base.text, base_revision: draft.base.revision,
      });
      client.setQueryData(queryKey, data);
      setDraft(null);
      setConflict(false);
      for (const key of [["submission", submissionId], ["submission-history", submissionId], ["submissions"], ["review-queue"], ["sentiment", submissionId], ["public-mood", submissionId]]) {
        void client.invalidateQueries({ queryKey: key });
      }
      toast.success("Text saved. Run the compliance check again before approval.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        void query.refetch();
      }
      toast.error((error as Error).message);
    } finally { setSaving(false); }
  };
  return { query, draft, text, changed, saving, checking, recheck, conflict: conflict || outdated, edit, cancel, save,
    setText: (value: string) => setDraft((current) => current && ({ ...current, text: value })) };
}
