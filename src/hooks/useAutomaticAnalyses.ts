import { useCallback, useEffect, useState } from "react";

type AutomaticAnalysesOptions = {
  submissionId: string | null;
  save: (opts?: { force?: boolean }) => Promise<string | null>;
  runMood: () => Promise<unknown>;
  runSentiment: () => void;
  onMoodError: (error: unknown) => void;
};

export function useAutomaticAnalyses({ submissionId, save, runMood, runSentiment, onMoodError }: AutomaticAnalysesOptions) {
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const refreshMood = useCallback(async () => {
    try { await save({ force: true }); return await runMood(); }
    catch (error) { onMoodError(error); }
  }, [onMoodError, runMood, save]);

  useEffect(() => {
    if (pendingFor && pendingFor === submissionId) {
      setPendingFor(null); void refreshMood(); runSentiment();
    }
  }, [pendingFor, refreshMood, runSentiment, submissionId]);

  return { refreshMood, startAutomaticAnalyses: setPendingFor };
}
