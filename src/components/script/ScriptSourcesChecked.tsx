import SourceChecks from "@/components/submissions/SourceChecks";
import { visibleSourceChecks } from "@/lib/sourceCheckVisibility";
import type { StoredCheck } from "@/types/submission";

export default function ScriptSourcesChecked({ check }: { check?: StoredCheck | null }) {
  const checks = visibleSourceChecks(check?.source_checks ?? []);
  if (!checks.length) return null;

  return (
    <details className="rounded-lg border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Sources checked ({checks.length})</summary>
      <div className="mt-2">
        <SourceChecks checks={checks} creator />
      </div>
    </details>
  );
}
