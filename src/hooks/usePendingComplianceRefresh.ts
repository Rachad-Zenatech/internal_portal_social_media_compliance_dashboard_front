import { useCallback, useEffect, useRef, useState } from "react";
import { pollPendingCheck } from "@/services/pendingCheckPolling";
import { submissionService } from "@/services/submissionService";
import { isAnalysing } from "@/components/submissions/submissionUi";
import type { Submission } from "@/types/submission";

export function usePendingComplianceRefresh(id: string | null, enabled: boolean, runKey: string | undefined, onResult: (data: Submission) => void) {
  const [failed, setFailed] = useState(false);
  const retryRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    setFailed(false);
    if (!id || !enabled) return;
    const poll = pollPendingCheck({ load: signal => submissionService.get(id, signal),
      onResult: result => { setFailed(false); onResult(result); return isAnalysing(result.latest_check); },
      onError: () => setFailed(true) });
    retryRef.current = poll.retry;
    return () => { retryRef.current = () => undefined; poll.stop(); };
  }, [id, enabled, runKey, onResult]);
  const retry = useCallback(() => retryRef.current(), []);
  return { failed, retry };
}
