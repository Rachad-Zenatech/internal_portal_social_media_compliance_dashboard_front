import { scriptService } from "@/services/scriptService";
import { scriptBatchService } from "@/services/scriptBatchService";
import type { ScriptStage } from "@/types/script";
import type { Batch } from "@/types/scriptBatch";

type CheckTask = { pending: readonly string[]; promise: Promise<unknown> };
const tasks = new Map<string, CheckTask>();
const listeners = new Set<() => void>();
const empty: readonly string[] = [];
const notify = () => listeners.forEach((listener) => listener());

export function subscribeScriptChecks(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function pendingScriptChecks(key: string): readonly string[] {
  return tasks.get(key)?.pending ?? empty;
}

/** Own the promise outside React: unmounting a page only unsubscribes its display. */
function track<T>(key: string, ids: string[], run: (complete: (id: string) => void) => Promise<T>): Promise<T> {
  const existing = tasks.get(key);
  if (existing) return existing.promise as Promise<T>;
  const complete = (id: string) => {
    const task = tasks.get(key);
    if (task) { task.pending = task.pending.filter((pending) => pending !== id); notify(); }
  };
  const promise = Promise.resolve().then(() => run(complete)).finally(() => { tasks.delete(key); notify(); });
  tasks.set(key, { pending: [...new Set(ids)], promise });
  notify();
  return promise;
}

export function runScriptCompliance(id: string, confirmRepost: boolean, onSaved: (stage: ScriptStage) => void, signal?: AbortSignal): Promise<ScriptStage> {
  return track(`script:${id}`, [id], async () => {
    signal?.throwIfAborted();
    const stage = await scriptService.precheck(id, confirmRepost, signal);
    signal?.throwIfAborted();
    onSaved(stage);
    return stage;
  });
}

/** Keep the entire queue alive after navigation; one failed script does not stop the rest. */
export function runBatchScriptCompliance(batchId: string, ids: string[], onSaved: (batch: Batch) => void): Promise<void> {
  return track(`batch:${batchId}`, ids, async (complete) => {
    const queue = [...new Set(ids)];
    const failures: string[] = [];
    const worker = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        try { onSaved(await scriptBatchService.checkItem(batchId, id)); }
        catch (error) { failures.push(error instanceof Error ? error.message : "Couldn't check the script"); }
        finally { complete(id); }
      }
    };
    await Promise.all([worker(), worker()]);
    if (failures.length) throw new Error(`${failures.length} script check(s) failed. ${failures[0]}`);
  });
}
