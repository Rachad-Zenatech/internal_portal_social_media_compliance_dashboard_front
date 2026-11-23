import { useEffect, useRef } from "react";

/** Recheck once per changed source set after the creator opens Compliance; cancellation does not restart it. */
export function useSourceComplianceRefresh({ enabled, busy, revision, onRefresh }: {
  enabled: boolean;
  busy: boolean;
  revision: string;
  onRefresh: () => Promise<void>;
}) {
  const attempted = useRef("");
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    if (!enabled || busy || attempted.current === revision) return;
    attempted.current = revision;
    void refresh.current();
  }, [enabled, busy, revision]);
}
