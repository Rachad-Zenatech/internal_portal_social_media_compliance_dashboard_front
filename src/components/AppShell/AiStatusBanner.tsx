import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { apiClient } from "@/services/apiClient";

interface AiStatus {
  available: boolean;
  reason?: "KEY" | "QUOTA" | "MODEL" | "BUSY" | "OTHER" | null;
  title?: string | null;
  message?: string | null;
  since?: string | null;
}

/**
 * A strip across the top of every page, for every signed-in user, while the AI (Gemini) isn't working: an expired
 * or revoked key, a used-up quota, retired models or an outage. Without it, posts just show missing scores and
 * nobody knows why. Gone as soon as a call works again.
 */
export default function AiStatusBanner() {
  const { data } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => apiClient.get<AiStatus>("/api/ai/status", { skipGlobalLoading: true }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    // A failed lookup says nothing about the AI: show nothing.
    retry: false,
  });
  if (!data || data.available) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-b border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="min-w-0">
        <span className="font-semibold">{data.title ?? "The AI isn't working"}</span>
        {data.since && <span className="text-amber-900/70 dark:text-amber-200/70"> · since {formatDistanceToNow(new Date(data.since))} ago</span>}
        {data.message && <span className="block text-amber-900/90 dark:text-amber-100/90">{data.message}</span>}
      </p>
    </div>
  );
}
