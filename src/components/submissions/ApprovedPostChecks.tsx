import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PrePublishMood from "@/components/submissions/PrePublishMood";

export default function ApprovedPostChecks({ submissionId, canPublish }: { submissionId: string; canPublish: boolean }) {
  return (
    <section className="space-y-4 border-t border-border/70 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Approved checks are available whenever you need them.</p>
        <Button asChild variant="outline"><Link to={`/submissions/new?id=${submissionId}&step=compliance`}>Open all checks</Link></Button>
      </div>
      <PrePublishMood submissionId={submissionId} canRun={canPublish} />
    </section>
  );
}
