import { runScriptCompliance } from "@/services/backgroundScriptChecks";
import { submissionService } from "@/services/submissionService";
import type { ScriptStage } from "@/types/script";
import type { CheckAttempt, Submission } from "@/types/submission";

/** Script drafts use the saved script check; finished posts use the streamed post check. */
export async function runPreparationCompliance(
  id: string,
  scriptDraft: boolean,
  onAttempt: (attempt: CheckAttempt) => void,
  onScriptChecked: (stage: ScriptStage) => void,
  confirmRepost = false,
): Promise<Submission> {
  if (!scriptDraft) return submissionService.runCheckStream(id, onAttempt, confirmRepost);
  const stage = await runScriptCompliance(id, confirmRepost, onScriptChecked);
  const submission = await submissionService.get(id);
  return { ...submission, latest_check: stage.precheck ?? null };
}
