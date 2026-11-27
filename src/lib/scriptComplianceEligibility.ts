import type { DocDetail } from "../types/scriptDoc";

/** Only a completed check for the current saved inputs can be reused. */
export function hasCurrentScriptCheck(doc: Pick<DocDetail, "latest_check" | "compliance_stale" | "sources_text">): boolean {
  const check = doc.latest_check;
  return Boolean(check && check.score != null && !check.ai_unavailable && !check.script_check_stale
    && doc.compliance_stale === false
    && (check.checked_script_sources ?? "").trim() === (doc.sources_text ?? "").trim());
}
