import type { ScriptVersion } from "@/types/script";
import type { StoredCheck } from "@/types/submission";

export const SOURCE_LABELS: Record<ScriptVersion["source"], string> = {
  UPLOAD: "Uploaded script",
  REVIEWER_EDIT: "Reviewer's edit",
  CREATOR_EDIT: "Creator's edit",
};

/** Score ring colours and the verdict line for a script check. */
export function scriptVerdict(check?: StoredCheck | null) {
  const v = check?.violations ?? [];
  const critical = v.filter((x) => x.traffic_light === "RED").length;
  if (!check) return { text: "Not checked", tone: "text-muted-foreground", ring: "border-muted", critical, open: 0 };
  if (critical) return { text: "Needs changes", tone: "text-red-700 dark:text-red-400", ring: "border-red-300 dark:border-red-500/50", critical, open: v.length };
  if (v.length) return { text: "Review suggested", tone: "text-amber-700 dark:text-amber-400", ring: "border-amber-300 dark:border-amber-500/50", critical, open: v.length };
  return { text: "Looks good", tone: "text-emerald-700 dark:text-emerald-400", ring: "border-emerald-300 dark:border-emerald-500/50", critical, open: 0 };
}
