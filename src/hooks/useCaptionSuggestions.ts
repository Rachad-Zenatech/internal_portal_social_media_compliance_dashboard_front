import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submissionService } from "@/services/submissionService";

/** Caption suggestions for a draft, and how many are left today. */
export function useCaptionSuggestions(submissionId?: string | null) {
  const queryClient = useQueryClient();

  const usage = useQuery({
    queryKey: ["ai-usage", submissionId],
    queryFn: () => submissionService.aiUsage(submissionId ?? undefined),
    staleTime: 30_000,
  });

  const suggest = useMutation({
    // The draft may only get its id when it's saved just before asking.
    mutationFn: ({ id, hint, maxChars }: { id: string; hint?: string; maxChars: number }) =>
      submissionService.suggestCaptions(id, { hint: hint?.trim() || undefined, max_chars: maxChars }),
    onError: (err) => toast.error(`Couldn't suggest captions: ${(err as Error).message}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ai-usage"] }),
  });

  return { suggest, usage: usage.data?.CAPTION ?? null };
}
