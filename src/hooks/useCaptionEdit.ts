import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { captionReviewService } from "@/services/captionReviewService";

/** Keep unsaved wording isolated while other reviewers' saved edits refresh in the background. */
export function useCaptionEdit(submissionId: string) {
  const client = useQueryClient();
  const key = ["caption-review", submissionId];
  const [platform, setPlatform] = useState("");
  const [editor, setEditor] = useState<{ base: string; draft: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => captionReviewService.get(submissionId, signal), refetchInterval: 30_000 });
  const current = (platform && query.data?.platform_captions[platform]) || query.data?.caption_text || "";
  const mutation = useMutation({
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    mutationFn: () => captionReviewService.save(submissionId, {
      base_caption: editor!.base, caption_text: editor!.draft, platform: platform || null,
    }),
    onSuccess: (data) => {
      client.setQueryData(key, data);
      setEditor(null);
      setSaved(true);
      for (const queryKey of [["submission", submissionId], ["submission-history", submissionId], ["review-queue"], ["submissions"],
        ["flag-reviews", submissionId], ["flag-verdicts", submissionId], ["creator-flag-dismissals", submissionId]]) {
        void client.invalidateQueries({ queryKey });
      }
      toast.success("Text changes saved.");
    },
  });
  const start = () => { mutation.reset(); setEditor({ base: current, draft: current }); };
  const cancel = () => { if (!mutation.isPending) { setEditor(null); mutation.reset(); void query.refetch(); } };
  const setDraft = (draft: string) => setEditor((previous) => previous && { ...previous, draft });
  const save = () => { if (editor && editor.draft !== editor.base && !mutation.isPending) mutation.mutate(); };
  return { query, platform, setPlatform, current, editor, setDraft, start, cancel, save, saved,
    saving: mutation.isPending, error: mutation.error?.message };
}
