import { reviewTextChanged, type ReviewTextValue } from "@/lib/reviewText";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTextReviewService } from "@/services/postTextReviewService";
import { ApiError } from "@/services/helper";
import type { PostTextReview } from "@/types/postTextReview";
import { useReviewerComplianceCheck } from "@/hooks/useReviewerComplianceCheck";

export function usePostTextReview(submissionId: string) {
  const client = useQueryClient();
  const queryKey = ["post-text-review", submissionId];
  const query = useQuery({ queryKey, queryFn: () => postTextReviewService.get(submissionId), refetchInterval: 5000 });
  const [draft, setDraft] = useState<{ text: string; html: string | null; base: PostTextReview } | null>(null);
  const [saving, setSaving] = useState(false);
  const { checking, recheck: checkCompliance } = useReviewerComplianceCheck(submissionId);
  const [needsRecheck, setNeedsRecheck] = useState(false);
  const [conflict, setConflict] = useState(false);
  const text = draft?.text ?? query.data?.text ?? "";
  const html = draft ? draft.html : query.data?.html ?? null;
  const changed = Boolean(draft && reviewTextChanged({ text: draft.base.text, html: draft.base.html ?? null }, draft));
  const outdated = Boolean(draft && query.data && (draft.base.revision !== query.data.revision || draft.base.text !== query.data.text || draft.base.html !== query.data.html));
  const edit = () => {
    if (query.data) { setDraft({ text: query.data.text, html: query.data.html ?? null, base: query.data }); setConflict(false); }
  };
  const cancel = () => { setDraft(null); setConflict(false); };
  const recheck = async () => {
    if (draft) return;
    if (await checkCompliance()) setNeedsRecheck(false);
  };
  const save = async () => {
    if (!draft || saving || !changed) return;
    setSaving(true);
    try {
      const data = await postTextReviewService.save(submissionId, {
        text: draft.text, html: draft.html, base_html: draft.base.html ?? null, base_text: draft.base.text, base_revision: draft.base.revision,
      });
      client.setQueryData(queryKey, data);
      setNeedsRecheck(true);
      setDraft(null);
      setConflict(false);
      for (const key of [["submission", submissionId], ["submission-history", submissionId], ["submissions"], ["review-queue"], ["sentiment", submissionId], ["public-mood", submissionId]]) {
        void client.invalidateQueries({ queryKey: key });
      }
      toast.success("Text saved.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
        void query.refetch();
      }
      toast.error((error as Error).message);
    } finally { setSaving(false); }
  };
  return { query, draft, text, html, changed, saving, checking, recheck, needsRecheck, conflict: conflict || outdated, edit, cancel, save,
    setValue: (value: ReviewTextValue) => setDraft(current => current && ({ ...current, ...value })),
    setText: (value: string) => setDraft((current) => current && ({ ...current, text: value })) };
}
