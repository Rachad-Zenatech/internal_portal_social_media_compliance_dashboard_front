import { useSyncExternalStore } from "react";
import { pendingScriptChecks, subscribeScriptChecks } from "@/services/backgroundScriptChecks";

/** Reconnect to checks already running when a script or batch page is opened again. */
export function useScriptCheckStatus(kind: "script" | "batch" | "document", id?: string | null): readonly string[] {
  const snapshot = () => pendingScriptChecks(`${kind}:${id ?? ""}`);
  return useSyncExternalStore(subscribeScriptChecks, snapshot, snapshot);
}
