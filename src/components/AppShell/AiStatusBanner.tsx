import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { apiClient } from "@/services/apiClient";

interface FeatureIssue {
  feature: string;
  label: string;
  status: "OUT" | "OVERFLOW";
  reason: string;
  message: string;
  since?: string | null;
  affected_features?: string[];
}

interface AiStatus {
  available: boolean;
  reason?: "KEY" | "QUOTA" | "MODEL" | "BUSY" | "OTHER" | null;
  title?: string | null;
  message?: string | null;
  since?: string | null;
  degraded_features?: FeatureIssue[];
}

function IssueDetailsList({ issues }: { issues: FeatureIssue[] }) {
  return (
    <ul className="space-y-1 pt-1 text-xs opacity-90">
      {issues.map((issue) => (
        <li key={issue.feature}>
          <div>
            <strong>{issue.label} ({issue.status}):</strong> {issue.message}
            {issue.since ? ` · since ${formatDistanceToNow(new Date(issue.since))} ago` : ""}
          </div>
          {issue.affected_features && issue.affected_features.length > 0 && (
            <div className="pl-2 text-[11px] opacity-85">
              Affected features: {issue.affected_features.join(", ")}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Overhead alert strip across the top of every page whenever the AI globally or any specific AI feature
 * is out or experiencing overflow/throttling, so users never just see silent background failures.
 */
export default function AiStatusBanner() {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => apiClient.get<AiStatus>("/api/ai/status", { skipGlobalLoading: true }),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const issues = data?.degraded_features ?? [];
  if (!data || (data.available && issues.length === 0)) return null;

  const hasOut = !data.available || issues.some((i) => i.status === "OUT");
  const tone = hasOut
    ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
    : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100";
  const affectedSummary = Array.from(new Set(issues.flatMap((i) => i.affected_features ?? [])));

  return (
    <div role="alert" className={`border-b px-4 py-2 text-[13px] ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-1">
            {!data.available ? (
              <p>
                <span className="font-semibold">{data.title ?? "The AI isn't working"}</span>
                {data.since && <span className="opacity-75"> · since {formatDistanceToNow(new Date(data.since))} ago</span>}
                {data.message && <span className="block opacity-90">{data.message}</span>}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">AI feature issue{issues.length > 1 ? "s" : ""}:</span>
                {issues.map((issue) => (
                  <span key={issue.feature} title={issue.message} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${issue.status === "OUT" ? "border-rose-400/60 bg-rose-500/15" : "border-amber-400/60 bg-amber-500/15"}`}>
                    <span className="font-bold">{issue.status}</span>
                    <span>{issue.label}</span>
                  </span>
                ))}
                {affectedSummary.length > 0 && (
                  <span className="text-xs opacity-90">· Affects: {affectedSummary.join(", ")}</span>
                )}
              </div>
            )}
            {expanded && issues.length > 0 && <IssueDetailsList issues={issues} />}
          </div>
        </div>
        {issues.length > 0 && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">
            {expanded ? <>Hide <ChevronUp className="h-3.5 w-3.5" /></> : <>Details <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
      </div>
    </div>
  );
}
