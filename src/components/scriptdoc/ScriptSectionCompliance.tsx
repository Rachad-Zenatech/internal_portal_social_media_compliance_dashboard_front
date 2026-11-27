import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentScriptChecks } from "@/hooks/useDocumentScriptChecks";
import { hasCurrentScriptCheck } from "@/lib/scriptComplianceEligibility";
import type { DocDetail } from "@/types/scriptDoc";

export default function ScriptSectionCompliance({ doc, all = false, dirty, disabled, beforeCheck }: {
  doc: DocDetail; all?: boolean; dirty: boolean; disabled: boolean; beforeCheck: () => Promise<void>;
}) {
  const { run, busy, results } = useDocumentScriptChecks(doc, beforeCheck);
  const current = !dirty && (all
    ? results.length > 0 && results.every((result) => result.isSuccess && hasCurrentScriptCheck({
      latest_check: result.data, compliance_stale: result.data?.script_check_stale ?? true,
      sources_text: result.data?.checked_script_sources ?? "",
    }))
    : hasCurrentScriptCheck(doc));
  const check = all ? null : results[0]?.data ?? doc.latest_check;
  const label = all ? "Check compliance for all scripts" : "Check compliance";
  return (
    <div className="space-y-2 border-t pt-4" aria-live="polite">
      <Button disabled={disabled || busy || current} onClick={() => void run()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        {busy ? "Checking compliance..." : current ? (all ? "All scripts checked" : "Compliance checked") : label}
      </Button>
      {current && <p className="text-xs text-muted-foreground">Already checked. Change the script, details or sources to check again.</p>}
      {check?.score != null && !check.ai_unavailable && <p className="text-sm">Compliance score: {check.score}%{!current && " (previous check)"}</p>}
      {all && <p className="text-xs text-muted-foreground">Checks scripts that are new or changed. Unchanged scripts keep their saved results.</p>}
    </div>
  );
}
