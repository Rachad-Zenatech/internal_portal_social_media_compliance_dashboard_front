import { track } from "@/services/backgroundScriptChecks";
import { scriptDocService } from "@/services/scriptDocService";
import type { StoredCheck } from "@/types/submission";

/** Check each page independently; continue after a failure and keep running across navigation. */
export function runDocumentScriptCompliance(setId: string, ids: string[], onSaved: (id: string, check: StoredCheck) => void): Promise<void> {
  return track(`document:${setId}`, ids, async (complete) => {
    const queue = [...new Set(ids)];
    const failures: string[] = [];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try { onSaved(id, await scriptDocService.check(id)); }
        catch (error) { failures.push(error instanceof Error ? error.message : "Couldn't check the script"); }
        finally { complete(id); }
      }
    };
    await Promise.all([worker(), worker()]);
    if (failures.length) throw new Error(`${failures.length} script check(s) failed. ${failures[0]}`);
  });
}
