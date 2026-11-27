import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewerComplianceCheck } from "@/hooks/useReviewerComplianceCheck";

/** Keep a manual retry beside the reviewer's compliance results. */
export default function ReviewerComplianceRecheck({ submissionId, canRun }: { submissionId: string; canRun: boolean }) {
  const { checking, recheck, error } = useReviewerComplianceCheck(submissionId);
  if (!canRun) return null;
  const Icon = checking ? Loader2 : RefreshCw;
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={checking} onClick={() => void recheck()}>
        <Icon aria-hidden="true" className={checking ? "size-3.5 animate-spin" : "size-3.5"} />
        {checking ? "Checking compliance..." : "Recheck compliance"}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">The check could not finish. Please try again.</p>}
    </div>
  );
}
