import type { ScriptQueueItem } from "@/types/script";

export type ScriptQueueSummary = Pick<ScriptQueueItem, "id" | "script_status" | "batch_id">;
