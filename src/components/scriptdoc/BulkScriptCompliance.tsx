import { Link } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentScriptChecks } from "@/hooks/useDocumentScriptChecks";
import type { DocDetail } from "@/types/scriptDoc";

export default function BulkScriptCompliance({ doc, disabled, beforeCheck }: {
  doc: DocDetail; disabled: boolean; beforeCheck: () => Promise<void>;
}) {
  const { run, busy, pending, results } = useDocumentScriptChecks(doc, beforeCheck);
  if (doc.pages.length < 2) return null;
  const label = busy ? `Checking ${pending.length} remaining...` : `Run compliance for all ${doc.pages.length} scripts`;
  const summaries = doc.pages.flatMap((page, index) => {
    const check = results[index]?.data;
    if (!check) return [];
    const savedScore = check.ai_unavailable || check.score == null ? "Check incomplete" : `Score: ${check.score}%`;
    const score = check.script_check_stale ? `${savedScore} (changes made - rerun compliance)` : savedScore;
    return [{ id: page.id, title: page.title, score }];
  });
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="h-auto w-full whitespace-normal" disabled={disabled || busy} onClick={() => void run()}>
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4 shrink-0" />}
        {label}
      </Button>
      <ul className="space-y-1 text-xs" aria-live="polite">
        {summaries.map((summary) => <li key={summary.id}><Link className="block rounded px-1 py-1 hover:bg-muted" to={`/script-docs/${summary.id}`}>{summary.title}: {summary.score}</Link></li>)}
      </ul>
    </div>
  );
}
