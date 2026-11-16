import { useEffect, useState } from "react";

import { submissionService } from "@/services/submissionService";

/** Polls active background image-source scan jobs while viewing the compliance step, merged with any local check activity. */
export function useBackgroundSourceChecks(
  submissionId: string | null,
  active: boolean,
  localActivity: string[],
): string[] {
  const [remote, setRemote] = useState<string[]>([]);

  useEffect(() => {
    if (!active || !submissionId) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const jobs = await submissionService.getActiveImageSourceScanJobs(submissionId);
        if (cancelled) return;
        const labels = jobs.map((j) => j.message || "Scanning image and scraping source in the background...");
        setRemote(labels);
        if (labels.length > 0) timer = window.setTimeout(() => void poll(), 2000);
      } catch {
        if (!cancelled) setRemote([]);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [active, submissionId]);

  return [...new Set([...localActivity, ...remote])];
}

